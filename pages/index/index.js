const { parseXlsx } = require('../../utils/xlsx-parser.js')

Page({
  data: {
    excelData: [],
    displayData: [],
    searchKeyword: '',
    showLeaveInfo: true,
    // 用于模板的计算属性
    showSearch: false,
    showDataSection: false,
    showEmptyResult: false,
    showInitTip: true,
    sectionTitle: '所有学生'
  },

  onLoad() {
    console.log('页面加载完成')
    this.loadFromStorage()
  },

  onShow() {
    this.loadFromStorage()
  },

  // 更新显示状态
  updateDisplayState() {
    const { excelData, displayData, searchKeyword } = this.data
    const hasData = excelData.length > 0
    const hasDisplayData = displayData.length > 0

    this.setData({
      showSearch: hasData,
      showDataSection: hasData && (hasDisplayData || searchKeyword),
      showEmptyResult: hasData && !hasDisplayData && searchKeyword,
      showInitTip: !hasData,
      sectionTitle: searchKeyword ? '查询结果' : '所有学生'
    })
  },

  // 格式化学生数据用于显示
  formatStudentData(students) {
    return students.map(student => {
      const leaveRecords = (student.leaveRecords || []).map(leave => ({
        ...leave,
        displayTime: (leave.startTimeFormat || '-') + ' 至 ' + (leave.endTimeFormat || '-'),
        displayDuration: leave.duration || '-'
      }))

      return {
        ...student,
        displayName: student.姓名 || '-',
        displayGender: student.性别 || '-',
        displayId: student.学号 || '-',
        displayClass: student.班级 || '-',
        hasLeaveRecords: leaveRecords.length > 0,
        leaveCount: leaveRecords.length,
        leaveRecords: leaveRecords
      }
    })
  },

  chooseExcelFile() {
    const that = this
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['.xlsx', '.xls'],
      success(res) {
        const tempFilePath = res.tempFiles[0].path
        const fileName = res.tempFiles[0].name
        console.log('选择的文件', fileName, tempFilePath)

        wx.showLoading({
          title: '正在解析...',
          mask: true
        })

        // 读取文件内容
        const fs = wx.getFileSystemManager()
        fs.readFile({
          filePath: tempFilePath,
          success(fileRes) {
            // 微信小程序中，readFile默认返回ArrayBuffer
            // 需要转换为Uint8Array才能被JSZip正确解析
            const uint8Array = new Uint8Array(fileRes.data)
            // 解析 Excel 文件
            parseXlsx(uint8Array).then(data => {
              wx.hideLoading()

              if (data.length === 0) {
                wx.showToast({
                  title: '文件为空或格式不正确',
                  icon: 'none'
                })
                return
              }

              console.log('解析结果:', data)
              that.associateLeaveRecords(data)
              that.saveToStorage(data)

              wx.showToast({
                title: '解析成功',
                icon: 'success'
              })
            }).catch(err => {
              wx.hideLoading()
              console.error('解析Excel失败', err)
              wx.showToast({
                title: '解析失败，请检查文件格式',
                icon: 'none'
              })
            })
          },
          fail(err) {
            wx.hideLoading()
            console.error('读取文件失败', err)
            wx.showToast({
              title: '读取文件失败',
              icon: 'none'
            })
          }
        })
      },
      fail(err) {
        console.error('选择文件失败', err)
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        })
      }
    })
  },

  saveToStorage(data) {
    wx.setStorage({
      key: 'excelData',
      data: data,
      success() {
        console.log('数据保存到本地成功')
      },
      fail(err) {
        console.error('数据保存失败', err)
      }
    })
  },

  loadFromStorage() {
    const that = this
    wx.getStorage({
      key: 'excelData',
      success(res) {
        const students = res.data
        if (students && Array.isArray(students) && students.length > 0) {
          that.associateLeaveRecords(students)
        } else {
          console.log('存储中的数据为空')
          // 只有当前页面没有数据时才清空
          if (that.data.excelData.length === 0) {
            that.setData({
              excelData: [],
              displayData: []
            })
            that.updateDisplayState()
          }
        }
      },
      fail() {
        console.log('读取本地存储失败')
        // 读取失败时，保留当前页面已有的数据，不清空
        if (that.data.excelData.length === 0) {
          that.updateDisplayState()
        }
      }
    })
  },

  associateLeaveRecords(students) {
    const that = this
    wx.getStorage({
      key: 'leaveRecords',
      success(res) {
        const leaveRecords = res.data || []
        console.log('读取到请假记录:', leaveRecords.length, '条')
        console.log('请假记录详情:', JSON.stringify(leaveRecords))

        const studentsWithLeave = students.map(student => {
          const studentLeaveRecords = leaveRecords.filter(record => {
            // 使用字符串比较，避免类型不匹配问题
            return record.student && String(record.student.学号) === String(student.学号)
          })
          if (studentLeaveRecords.length > 0) {
            console.log('学生', student.姓名, '关联到', studentLeaveRecords.length, '条请假记录')
          }

          return {
            ...student,
            leaveRecords: studentLeaveRecords
          }
        })

        const formattedData = that.formatStudentData(studentsWithLeave)
        that.setData({
          excelData: studentsWithLeave,
          displayData: formattedData
        })
        that.updateDisplayState()
        console.log('关联请假记录成功')
      },
      fail() {
        console.log('未找到请假记录存储，显示学生列表')
        const formattedData = that.formatStudentData(students)
        that.setData({
          excelData: students,
          displayData: formattedData
        })
        that.updateDisplayState()
      }
    })
  },

  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  searchStudent() {
    const keyword = this.data.searchKeyword.trim()
    if (!keyword) {
      wx.showToast({
        title: '请输入查询关键词',
        icon: 'none'
      })
      return
    }

    const allData = this.data.excelData
    const filteredData = allData.filter(item => {
      const matchName = item.姓名 && item.姓名.includes(keyword)
      const matchId = item.学号 && item.学号.includes(keyword)
      return matchName || matchId
    })

    const formattedData = this.formatStudentData(filteredData)
    this.setData({
      displayData: formattedData
    })
    this.updateDisplayState()

    console.log('查询结果', filteredData)
  },

  clearSearch() {
    const formattedData = this.formatStudentData(this.data.excelData)
    this.setData({
      searchKeyword: '',
      displayData: formattedData
    })
    this.updateDisplayState()
  },

  // 切换请假记录展开/折叠
  toggleLeaveExpand(e) {
    const index = e.currentTarget.dataset.index
    const key = `displayData[${index}].expanded`
    this.setData({
      [key]: !this.data.displayData[index].expanded
    })
  },

  // 编辑请假记录
  editLeaveRecord(e) {
    const leave = e.currentTarget.dataset.leave
    console.log('编辑请假记录:', leave)
    if (!leave || !leave.id) {
      wx.showToast({
        title: '记录数据异常',
        icon: 'none'
      })
      return
    }
    // 跳转到编辑页面
    wx.navigateTo({
      url: `/pages/leave-edit/leave-edit?leaveId=${leave.id}`
    })
  },

  // 删除请假记录
  deleteLeaveRecord(e) {
    const leave = e.currentTarget.dataset.leave
    const that = this

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条请假记录吗？',
      success(res) {
        if (res.confirm) {
          that.doDeleteLeaveRecord(leave.id)
        }
      }
    })
  },

  // 执行删除请假记录
  doDeleteLeaveRecord(leaveId) {
    const that = this
    wx.getStorage({
      key: 'leaveRecords',
      success(res) {
        const records = res.data || []
        // 使用字符串比较避免类型问题
        const newRecords = records.filter(r => String(r.id) !== String(leaveId))

        wx.setStorage({
          key: 'leaveRecords',
          data: newRecords,
          success() {
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
            // 重新加载数据
            that.loadFromStorage()
          },
          fail() {
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        })
      },
      fail() {
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        })
      }
    })
  },

  // 下载Excel模板
  downloadTemplate() {
    // 生成CSV格式的模板内容
    const templateContent = '姓名,性别,学号,班级\n张三,男,20230001,计算机1班\n李四,女,20230002,计算机2班\n'

    // 获取文件系统管理器
    const fs = wx.getFileSystemManager()

    // 生成临时文件路径
    const tempFilePath = `${wx.env.USER_DATA_PATH}/student_template.csv`

    // 写入文件
    fs.writeFile({
      filePath: tempFilePath,
      data: templateContent,
      encoding: 'utf-8',
      success() {
        // 使用 shareFileMessage 分享文件
        wx.shareFileMessage({
          filePath: tempFilePath,
          fileName: 'student_template.csv',
          success() {
            console.log('分享成功')
          },
          fail(err) {
            console.log('分享取消或失败', err)
            // 分享失败时，提示用户模板格式
            wx.showModal({
              title: '模板格式说明',
              content: 'Excel模板包含4列：姓名、性别、学号、班级。\n\n请按此格式创建Excel文件后上传。',
              showCancel: false
            })
          }
        })
      },
      fail(err) {
        console.error('生成模板失败', err)
        wx.showModal({
          title: '模板格式说明',
          content: 'Excel模板包含4列：姓名、性别、学号、班级。\n\n请按此格式创建Excel文件后上传。',
          showCancel: false
        })
      }
    })
  },

  // 新增学生
  addStudent() {
    wx.navigateTo({
      url: '/pages/student-edit/student-edit'
    })
  },

  // 编辑学生
  editStudent(e) {
    const index = e.currentTarget.dataset.index
    // 需要在原始数据中找到对应的索引
    const displayItem = this.data.displayData[index]
    const originalIndex = this.data.excelData.findIndex(item =>
      item.学号 === displayItem.学号
    )

    if (originalIndex === -1) {
      wx.showToast({
        title: '学生数据异常',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: `/pages/student-edit/student-edit?mode=edit&index=${originalIndex}`
    })
  },

  // 删除学生
  deleteStudent(e) {
    const index = e.currentTarget.dataset.index
    const student = e.currentTarget.dataset.student
    const that = this

    wx.showModal({
      title: '确认删除',
      content: `确定要删除学生 "${student.displayName}" 吗？该学生的请假记录也将被删除。`,
      success(res) {
        if (res.confirm) {
          that.doDeleteStudent(student)
        }
      }
    })
  },

  // 执行删除学生
  doDeleteStudent(student) {
    const that = this
    const studentId = student.学号

    wx.getStorage({
      key: 'excelData',
      success(res) {
        const students = res.data || []
        const newStudents = students.filter(s => String(s.学号) !== String(studentId))

        wx.setStorage({
          key: 'excelData',
          data: newStudents,
          success() {
            // 同时删除该学生的请假记录
            that.deleteStudentLeaveRecords(studentId)

            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
            // 重新加载数据
            that.loadFromStorage()
          },
          fail() {
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        })
      },
      fail() {
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        })
      }
    })
  },

  // 删除学生的请假记录
  deleteStudentLeaveRecords(studentId) {
    wx.getStorage({
      key: 'leaveRecords',
      success(res) {
        const records = res.data || []
        const newRecords = records.filter(r =>
          !r.student || String(r.student.学号) !== String(studentId)
        )

        wx.setStorage({
          key: 'leaveRecords',
          data: newRecords
        })
      }
    })
  }
})
