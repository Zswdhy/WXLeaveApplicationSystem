Page({
  data: {
    selectedMonth: '',
    selectedMonthFormat: '',
    // 全部请假记录（只显示有请假的学生）
    allLeaveData: [],
    // 长期请假记录（>=3天）
    longLeaveData: [],
    hasData: false,
    hasLongLeave: false,
    emptyTip: '请先选择月份查看汇总数据'
  },

  onLoad() {
    console.log('汇总页面加载完成')
    this.initMonth()
  },

  onShow() {
    this.generateSummary()
  },

  // 初始化月份
  initMonth() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const monthStr = year + '-' + month

    this.setData({
      selectedMonth: monthStr,
      selectedMonthFormat: year + '年' + month + '月'
    })
  },

  // 月份选择变化
  onMonthChange(e) {
    const value = e.detail.value
    const parts = value.split('-')
    const year = parts[0]
    const month = parts[1]

    this.setData({
      selectedMonth: value,
      selectedMonthFormat: year + '年' + month + '月'
    })
    this.generateSummary()
  },

  // 生成汇总数据
  generateSummary() {
    const that = this

    wx.getStorage({
      key: 'leaveRecords',
      success(leavesRes) {
        const allLeaveRecords = leavesRes.data || []
        that.processSummaryData(allLeaveRecords)
      },
      fail() {
        that.setData({
          allLeaveData: [],
          longLeaveData: [],
          hasData: false,
          hasLongLeave: false,
          emptyTip: '暂无请假记录'
        })
      }
    })
  },

  // 处理汇总数据
  processSummaryData(leaveRecords) {
    const selectedMonth = this.data.selectedMonth
    const parts = selectedMonth.split('-')
    const targetYear = parseInt(parts[0])
    const targetMonth = parseInt(parts[1]) - 1

    // 过滤当月的请假记录
    const monthRecords = leaveRecords.filter(record => {
      if (!record.student || !record.startTime) return false
      const recordDate = new Date(record.startTime)
      return recordDate.getFullYear() === targetYear && recordDate.getMonth() === targetMonth
    })

    // 按学生分组
    const studentMap = {}
    monthRecords.forEach(record => {
      const studentId = record.student.学号
      if (!studentMap[studentId]) {
        studentMap[studentId] = {
          student: record.student,
          records: []
        }
      }

      // 计算请假天数
      const start = new Date(record.startTime)
      const end = new Date(record.endTime)
      const diffMs = end - start
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const leaveDays = Math.ceil(diffHours / 24)

      studentMap[studentId].records.push({
        ...record,
        leaveDays: leaveDays,
        isLongLeave: leaveDays >= 3,
        displayTime: (record.startTimeFormat || '-') + ' 至 ' + (record.endTimeFormat || '-'),
        displayDuration: record.duration || '-'
      })
    })

    // 生成全部请假数据
    const allLeaveData = []
    const longLeaveData = []

    Object.keys(studentMap).forEach(studentId => {
      const data = studentMap[studentId]
      const student = data.student
      const records = data.records

      // 全部记录
      allLeaveData.push({
        studentId: studentId,
        displayName: student.姓名 || '-',
        displayClass: student.班级 || '-',
        displayInfo: (student.学号 || '-') + ' | ' + (student.班级 || '-'),
        leaveCount: records.length,
        leaveRecords: records
      })

      // 筛选>=3天的记录
      const longRecords = records.filter(r => r.isLongLeave)
      if (longRecords.length > 0) {
        longLeaveData.push({
          studentId: studentId,
          displayName: student.姓名 || '-',
          displayClass: student.班级 || '-',
          displayInfo: (student.学号 || '-') + ' | ' + (student.班级 || '-'),
          leaveCount: longRecords.length,
          leaveRecords: longRecords
        })
      }
    })

    this.setData({
      allLeaveData: allLeaveData,
      longLeaveData: longLeaveData,
      hasData: allLeaveData.length > 0,
      hasLongLeave: longLeaveData.length > 0,
      emptyTip: '当前月份没有请假记录'
    })
  },

  // 长按复制全部记录
  copyAllRecords() {
    const text = this.generateCopyText(this.data.allLeaveData, '全部请假记录')
    this.doCopy(text)
  },

  // 长按复制长期请假记录
  copyLongLeaveRecords() {
    const text = this.generateCopyText(this.data.longLeaveData, '长期请假记录(>=3天)')
    this.doCopy(text)
  },

  // 切换长期请假记录展开/折叠
  toggleLongLeaveExpand(e) {
    const index = e.currentTarget.dataset.index
    const key = `longLeaveData[${index}].expanded`
    this.setData({
      [key]: !this.data.longLeaveData[index].expanded
    })
  },

  // 生成复制文本
  generateCopyText(data, title) {
    const month = this.data.selectedMonthFormat
    let text = `【${month}${title}】\n\n`

    data.forEach((item, index) => {
      text += `${index + 1}. ${item.displayName}（${item.displayInfo}）\n`
      text += `   请假${item.leaveCount}次：\n`

      item.leaveRecords.forEach(record => {
        text += `   - ${record.displayTime}\n`
        text += `     时长：${record.displayDuration}\n`
      })
      text += '\n'
    })

    return text.trim()
  },

  // 执行复制
  doCopy(text) {
    if (!text) {
      wx.showToast({
        title: '没有可复制的内容',
        icon: 'none'
      })
      return
    }

    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      },
      fail() {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        })
      }
    })
  }
})
