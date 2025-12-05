Page({
  data: {
    studentsList: [],
    selectedStudent: null,
    startDate: '',
    startHour: '',
    endDate: '',
    endHour: '',
    startTimeFormat: '',
    endTimeFormat: '',
    leaveDuration: '',
    canSubmit: false,
    isSubmitting: false, // 防止重复提交
    // 小时选择列表
    hourList: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'],
    startHourIndex: 0,
    endHourIndex: 0,
    // 用于显示的字段
    studentPickerText: '请选择学生',
    displayStartDate: '请选择日期',
    displayStartHour: '请选择时间',
    displayEndDate: '请选择日期',
    displayEndHour: '请选择时间',
    displayDuration: '请选择时间计算',
    // 编辑模式
    isEditMode: false,
    editLeaveId: null,
    pageTitle: '请假申请'
  },

  onLoad(options) {
    console.log('请假页面加载完成', options)
    this.loadStudents()

    // 检查是否为编辑模式
    if (options.mode === 'edit' && options.leaveId) {
      this.setData({
        isEditMode: true,
        editLeaveId: options.leaveId, // 保持字符串，避免大数字精度问题
        pageTitle: '修改请假'
      })
      this.loadLeaveRecord(options.leaveId)
    } else {
      this.initDateTime()
    }
  },

  // 加载请假记录用于编辑
  loadLeaveRecord(leaveId) {
    const that = this
    console.log('加载请假记录, leaveId:', leaveId, typeof leaveId)
    wx.getStorage({
      key: 'leaveRecords',
      success(res) {
        const records = res.data || []
        console.log('存储中的记录数:', records.length)
        // 使用字符串比较避免类型问题
        const record = records.find(r => String(r.id) === String(leaveId))
        console.log('找到的记录:', record)

        if (record) {
          // 解析时间，添加安全检查
          const startParts = (record.startTimeFormat || '').split(' ')
          const endParts = (record.endTimeFormat || '').split(' ')

          const startDate = startParts[0] || ''
          const startHour = startParts[1] || ''
          const endDate = endParts[0] || ''
          const endHour = endParts[1] || ''

          console.log('解析的时间:', { startDate, startHour, endDate, endHour })

          that.setData({
            selectedStudent: record.student,
            startDate: startDate,
            startHour: startHour,
            endDate: endDate,
            endHour: endHour,
            displayStartDate: startDate || '请选择日期',
            displayStartHour: startHour || '请选择时间',
            displayEndDate: endDate || '请选择日期',
            displayEndHour: endHour || '请选择时间',
            studentPickerText: record.student ? (record.student.姓名 + ' - ' + record.student.学号) : '请选择学生',
            leaveDuration: record.duration || '',
            displayDuration: record.duration || '请选择时间计算',
            canSubmit: true
          })
          that.updateTimeFormat()
        } else {
          wx.showToast({
            title: '未找到请假记录',
            icon: 'none'
          })
          that.initDateTime()
        }
      },
      fail() {
        wx.showToast({
          title: '加载记录失败',
          icon: 'none'
        })
        that.initDateTime()
      }
    })
  },

  // 初始化日期时间
  initDateTime() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = now.getHours()

    const dateStr = year + '-' + month + '-' + day
    const timeStr = String(hour).padStart(2, '0') + ':00'
    const hourIndex = hour

    this.setData({
      startDate: dateStr,
      startHour: timeStr,
      endDate: dateStr,
      endHour: timeStr,
      startHourIndex: hourIndex,
      endHourIndex: hourIndex,
      displayStartDate: dateStr,
      displayStartHour: timeStr,
      displayEndDate: dateStr,
      displayEndHour: timeStr
    })
    this.updateTimeFormat()
  },

  // 加载学生列表
  loadStudents() {
    const that = this
    wx.getStorage({
      key: 'excelData',
      success(res) {
        const students = res.data
        const studentsList = students.map(function(item) {
          return {
            姓名: item.姓名,
            学号: item.学号,
            性别: item.性别,
            班级: item.班级,
            nameId: item.姓名 + ' - ' + item.学号
          }
        })
        that.setData({
          studentsList: studentsList
        })
      },
      fail() {
        wx.showToast({
          title: '请先上传学生信息',
          icon: 'none'
        })
        setTimeout(function() {
          wx.navigateBack()
        }, 1500)
      }
    })
  },

  // 更新显示文本
  updateDisplayText() {
    const { selectedStudent, startDate, startHour, endDate, endHour, leaveDuration } = this.data

    this.setData({
      studentPickerText: selectedStudent ? (selectedStudent.姓名 + ' - ' + selectedStudent.学号) : '请选择学生',
      displayStartDate: startDate ? startDate : '请选择日期',
      displayStartHour: startHour ? startHour : '请选择时间',
      displayEndDate: endDate ? endDate : '请选择日期',
      displayEndHour: endHour ? endHour : '请选择时间',
      displayDuration: leaveDuration ? leaveDuration : '请选择时间计算'
    })
  },

  // 更新时间格式
  updateTimeFormat() {
    const { startDate, startHour, endDate, endHour } = this.data

    var startTimeFormat = ''
    var endTimeFormat = ''

    if (startDate && startHour) {
      startTimeFormat = startDate + ' ' + startHour
    }
    if (endDate && endHour) {
      endTimeFormat = endDate + ' ' + endHour
    }

    this.setData({
      startTimeFormat: startTimeFormat,
      endTimeFormat: endTimeFormat
    })

    this.calculateLeaveDuration()
    this.updateDisplayText()
  },

  // 选择学生
  onStudentChange(e) {
    const index = e.detail.value
    const selectedStudent = this.data.studentsList[index]
    this.setData({
      selectedStudent: selectedStudent,
      studentPickerText: selectedStudent.姓名 + ' - ' + selectedStudent.学号
    })
    this.checkSubmitEnable()
  },

  // 开始日期选择
  onStartDateChange(e) {
    const newStartDate = e.detail.value
    this.setData({
      startDate: newStartDate,
      displayStartDate: newStartDate,
      // 结束日期自动同步为开始日期
      endDate: newStartDate,
      displayEndDate: newStartDate
    })
    this.updateTimeFormat()
  },

  // 开始时间选择（小时）
  onStartTimeChange(e) {
    const index = e.detail.value
    const hour = this.data.hourList[index]
    this.setData({
      startHour: hour,
      startHourIndex: index,
      displayStartHour: hour
    })
    this.updateTimeFormat()
  },

  // 结束日期选择
  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value,
      displayEndDate: e.detail.value
    })
    this.updateTimeFormat()
  },

  // 结束时间选择（小时）
  onEndTimeChange(e) {
    const index = e.detail.value
    const hour = this.data.hourList[index]
    this.setData({
      endHour: hour,
      endHourIndex: index,
      displayEndHour: hour
    })
    this.updateTimeFormat()
  },

  // 计算请假时长
  calculateLeaveDuration() {
    const { startDate, startHour, endDate, endHour } = this.data

    if (!startDate || !startHour || !endDate || !endHour) {
      this.setData({
        leaveDuration: '请选择完整时间',
        displayDuration: '请选择完整时间',
        canSubmit: false
      })
      return
    }

    const start = new Date(startDate + ' ' + startHour)
    const end = new Date(endDate + ' ' + endHour)

    if (end <= start) {
      this.setData({
        leaveDuration: '结束时间必须大于开始时间',
        displayDuration: '结束时间必须大于开始时间',
        canSubmit: false
      })
      return
    }

    const diffMs = end - start
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const days = Math.floor(diffMinutes / (24 * 60))
    const hours = Math.floor((diffMinutes % (24 * 60)) / 60)
    const minutes = diffMinutes % 60

    var durationText = ''
    if (days > 0) {
      durationText += days + '天'
    }
    if (hours > 0) {
      durationText += hours + '小时'
    }
    if (minutes > 0) {
      durationText += minutes + '分钟'
    }

    if (!durationText) {
      durationText = '0分钟'
    }

    this.setData({
      leaveDuration: durationText,
      displayDuration: durationText,
      canSubmit: true
    })
    this.checkSubmitEnable()
  },

  // 检查是否可以提交
  checkSubmitEnable() {
    const hasStudent = this.data.selectedStudent
    const leaveDuration = this.data.leaveDuration
    const hasValidDuration = leaveDuration &&
      leaveDuration !== '结束时间必须大于开始时间' &&
      leaveDuration !== '请选择完整时间'

    this.setData({
      canSubmit: hasStudent && hasValidDuration
    })
  },

  // 提交请假申请
  submitLeave() {
    // 检查是否选择了学生
    if (!this.data.selectedStudent) {
      wx.showToast({
        title: '请先选择学生',
        icon: 'none'
      })
      return
    }

    if (!this.data.canSubmit || this.data.isSubmitting) {
      return
    }

    // 设置提交中状态，防止重复点击
    this.setData({ isSubmitting: true })

    const that = this
    const { startDate, startHour, endDate, endHour, isEditMode, editLeaveId, selectedStudent } = this.data
    const startTime = new Date(startDate + ' ' + startHour).getTime()
    const endTime = new Date(endDate + ' ' + endHour).getTime()

    // 检查时间冲突
    this.checkTimeConflict(selectedStudent.学号, startTime, endTime, isEditMode ? editLeaveId : null)
      .then(result => {
        if (result.hasConflict) {
          that.setData({ isSubmitting: false })
          const conflictRecord = result.conflictRecord
          wx.showModal({
            title: '时间冲突',
            content: '该学生在 ' + conflictRecord.startTimeFormat + ' 至 ' + conflictRecord.endTimeFormat + ' 已有请假记录，时间不能交叉',
            showCancel: false
          })
          return
        }

        // 无冲突，继续提交
        const leaveRecord = {
          id: isEditMode ? editLeaveId : Date.now(),
          student: selectedStudent,
          startTime: startTime,
          endTime: endTime,
          duration: that.data.leaveDuration,
          startTimeFormat: that.data.startTimeFormat,
          endTimeFormat: that.data.endTimeFormat,
          submitTime: new Date().getTime()
        }

        if (isEditMode) {
          that.updateLeaveRecord(leaveRecord)
        } else {
          that.saveLeaveRecord(leaveRecord)
        }
      })
  },

  // 重置表单
  resetForm() {
    // 获取当前时间
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = now.getHours()

    const dateStr = year + '-' + month + '-' + day
    const timeStr = String(hour).padStart(2, '0') + ':00'

    // 只清空学生信息，时间重置为当前时间
    this.setData({
      selectedStudent: null,
      studentPickerText: '请选择学生',
      startDate: dateStr,
      startHour: timeStr,
      endDate: dateStr,
      endHour: timeStr,
      startHourIndex: hour,
      endHourIndex: hour,
      displayStartDate: dateStr,
      displayStartHour: timeStr,
      displayEndDate: dateStr,
      displayEndHour: timeStr,
      startTimeFormat: dateStr + ' ' + timeStr,
      endTimeFormat: dateStr + ' ' + timeStr,
      leaveDuration: '',
      displayDuration: '请选择时间计算',
      canSubmit: false,
      isSubmitting: false
    })
  },

  // 更新请假记录
  updateLeaveRecord(record) {
    const that = this
    wx.getStorage({
      key: 'leaveRecords',
      success(res) {
        const records = res.data || []
        // 使用字符串比较避免类型问题
        const index = records.findIndex(r => String(r.id) === String(record.id))

        if (index !== -1) {
          records[index] = record
          that.updateLeaveStorage(records, '修改成功')
        } else {
          // 重置提交状态
          that.setData({ isSubmitting: false })
          wx.showToast({
            title: '记录不存在',
            icon: 'none'
          })
        }
      },
      fail() {
        // 重置提交状态
        that.setData({ isSubmitting: false })
        wx.showToast({
          title: '更新失败',
          icon: 'none'
        })
      }
    })
  },

  // 保存请假记录
  saveLeaveRecord(record) {
    const that = this
    wx.getStorage({
      key: 'leaveRecords',
      success(res) {
        const records = res.data || []
        console.log('现有请假记录数:', records.length)
        records.push(record)
        console.log('添加后请假记录数:', records.length)
        that.updateLeaveStorage(records, '提交成功')
      },
      fail() {
        console.log('首次创建请假记录')
        that.updateLeaveStorage([record], '提交成功')
      }
    })
  },

  // 检查时间是否有交叉
  checkTimeConflict(studentId, startTime, endTime, excludeId) {
    return new Promise((resolve, reject) => {
      wx.getStorage({
        key: 'leaveRecords',
        success(res) {
          const records = res.data || []
          // 查找同一学生的其他请假记录
          const conflictRecord = records.find(record => {
            // 排除当前编辑的记录
            if (excludeId && String(record.id) === String(excludeId)) {
              return false
            }
            // 检查是否是同一学生
            if (record.student.学号 !== studentId) {
              return false
            }
            // 检查时间是否有交叉
            // 两个时间段有交叉的条件：开始时间A < 结束时间B 且 结束时间A > 开始时间B
            const hasOverlap = startTime < record.endTime && endTime > record.startTime
            return hasOverlap
          })

          if (conflictRecord) {
            resolve({
              hasConflict: true,
              conflictRecord: conflictRecord
            })
          } else {
            resolve({
              hasConflict: false
            })
          }
        },
        fail() {
          // 没有记录，不存在冲突
          resolve({
            hasConflict: false
          })
        }
      })
    })
  },

  // 更新请假记录到本地存储
  updateLeaveStorage(records, successMsg) {
    const that = this
    wx.setStorage({
      key: 'leaveRecords',
      data: records,
      success() {
        wx.showToast({
          title: successMsg || '操作成功',
          icon: 'success'
        })
        // 提交成功后重置表单
        that.resetForm()
        setTimeout(function() {
          wx.navigateBack()
        }, 1500)
      },
      fail(err) {
        console.error('保存请假记录失败', err)
        // 提交失败时重置提交状态，允许重新提交
        that.setData({ isSubmitting: false })
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'none'
        })
      }
    })
  }
})
