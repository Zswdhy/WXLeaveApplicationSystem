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
    isSubmitting: false,
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
    editLeaveId: null
  },

  onLoad(options) {
    console.log('编辑页面加载', options)

    if (options.leaveId) {
      this.setData({
        editLeaveId: options.leaveId
      })
      this.loadLeaveRecord(options.leaveId)
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  // 加载请假记录
  loadLeaveRecord(leaveId) {
    const that = this
    console.log('加载请假记录, leaveId:', leaveId)
    wx.getStorage({
      key: 'leaveRecords',
      success(res) {
        const records = res.data || []
        console.log('存储中的记录数:', records.length)
        const record = records.find(r => String(r.id) === String(leaveId))
        console.log('找到的记录:', record)

        if (record) {
          // 解析时间
          const startParts = (record.startTimeFormat || '').split(' ')
          const endParts = (record.endTimeFormat || '').split(' ')

          const startDate = startParts[0] || ''
          const endDate = endParts[0] || ''

          // 提取小时并转换为整点格式
          let startHour = startParts[1] || '00:00'
          let endHour = endParts[1] || '00:00'

          // 转换为整点格式 (如 "09:30" -> "09:00")
          startHour = startHour.split(':')[0] + ':00'
          endHour = endHour.split(':')[0] + ':00'

          // 找到对应的索引
          const startHourIndex = that.data.hourList.indexOf(startHour)
          const endHourIndex = that.data.hourList.indexOf(endHour)

          console.log('解析的时间:', { startDate, startHour, endDate, endHour })

          that.setData({
            selectedStudent: record.student,
            startDate: startDate,
            startHour: startHour,
            endDate: endDate,
            endHour: endHour,
            startHourIndex: startHourIndex >= 0 ? startHourIndex : 0,
            endHourIndex: endHourIndex >= 0 ? endHourIndex : 0,
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
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
      },
      fail() {
        wx.showToast({
          title: '加载记录失败',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
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
  },

  // 开始日期选择
  onStartDateChange(e) {
    const newStartDate = e.detail.value
    this.setData({
      startDate: newStartDate,
      displayStartDate: newStartDate,
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
  },

  // 提交修改
  submitEdit() {
    if (!this.data.canSubmit || this.data.isSubmitting) {
      return
    }

    this.setData({ isSubmitting: true })

    const that = this
    const { startDate, startHour, endDate, endHour, editLeaveId, selectedStudent } = this.data
    const startTime = new Date(startDate + ' ' + startHour).getTime()
    const endTime = new Date(endDate + ' ' + endHour).getTime()

    // 检查时间冲突
    this.checkTimeConflict(selectedStudent.学号, startTime, endTime, editLeaveId)
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
        const updatedRecord = {
          id: editLeaveId,
          student: selectedStudent,
          startTime: startTime,
          endTime: endTime,
          duration: that.data.leaveDuration,
          startTimeFormat: that.data.startTimeFormat,
          endTimeFormat: that.data.endTimeFormat,
          submitTime: new Date().getTime()
        }

        that.updateLeaveRecord(updatedRecord)
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
          resolve({
            hasConflict: false
          })
        }
      })
    })
  },

  // 更新请假记录
  updateLeaveRecord(record) {
    const that = this
    wx.getStorage({
      key: 'leaveRecords',
      success(res) {
        const records = res.data || []
        const index = records.findIndex(r => String(r.id) === String(record.id))

        if (index !== -1) {
          records[index] = record
          wx.setStorage({
            key: 'leaveRecords',
            data: records,
            success() {
              wx.showToast({
                title: '修改成功',
                icon: 'success'
              })
              setTimeout(() => {
                wx.navigateBack()
              }, 1500)
            },
            fail() {
              that.setData({ isSubmitting: false })
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              })
            }
          })
        } else {
          that.setData({ isSubmitting: false })
          wx.showToast({
            title: '记录不存在',
            icon: 'none'
          })
        }
      },
      fail() {
        that.setData({ isSubmitting: false })
        wx.showToast({
          title: '更新失败',
          icon: 'none'
        })
      }
    })
  }
})
