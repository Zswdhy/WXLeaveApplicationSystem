Page({
  data: {
    isEditMode: false,
    studentIndex: -1,
    name: '',
    gender: '',
    studentId: '',
    className: '',
    genderList: ['男', '女'],
    genderIndex: 0,
    canSubmit: false,
    isSubmitting: false,
    pageTitle: '新增学生'
  },

  onLoad(options) {
    if (options.mode === 'edit' && options.index !== undefined) {
      this.setData({
        isEditMode: true,
        studentIndex: parseInt(options.index),
        pageTitle: '编辑学生'
      })
      this.loadStudentData(parseInt(options.index))
    }
  },

  // 加载学生数据用于编辑
  loadStudentData(index) {
    const that = this
    wx.getStorage({
      key: 'excelData',
      success(res) {
        const students = res.data || []
        if (index >= 0 && index < students.length) {
          const student = students[index]
          const genderIndex = that.data.genderList.indexOf(student.性别)
          that.setData({
            name: student.姓名 || '',
            gender: student.性别 || '',
            studentId: student.学号 || '',
            className: student.班级 || '',
            genderIndex: genderIndex >= 0 ? genderIndex : 0
          })
          that.checkSubmitEnable()
        } else {
          wx.showToast({
            title: '学生数据不存在',
            icon: 'none'
          })
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
      },
      fail() {
        wx.showToast({
          title: '加载数据失败',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    })
  },

  // 输入姓名
  onNameInput(e) {
    this.setData({
      name: e.detail.value
    })
    this.checkSubmitEnable()
  },

  // 选择性别
  onGenderChange(e) {
    const index = e.detail.value
    this.setData({
      genderIndex: index,
      gender: this.data.genderList[index]
    })
    this.checkSubmitEnable()
  },

  // 输入学号
  onStudentIdInput(e) {
    this.setData({
      studentId: e.detail.value
    })
    this.checkSubmitEnable()
  },

  // 输入班级
  onClassNameInput(e) {
    this.setData({
      className: e.detail.value
    })
    this.checkSubmitEnable()
  },

  // 检查是否可以提交
  checkSubmitEnable() {
    const { name, gender, studentId, className } = this.data
    const canSubmit = name.trim() && gender && studentId.trim() && className.trim()
    this.setData({
      canSubmit: !!canSubmit
    })
  },

  // 检查学号是否重复
  checkStudentIdDuplicate(studentId, excludeIndex) {
    return new Promise((resolve) => {
      wx.getStorage({
        key: 'excelData',
        success(res) {
          const students = res.data || []
          const duplicate = students.find((student, index) => {
            if (excludeIndex !== -1 && index === excludeIndex) {
              return false
            }
            return String(student.学号) === String(studentId)
          })
          resolve(!!duplicate)
        },
        fail() {
          resolve(false)
        }
      })
    })
  },

  // 提交
  async submitStudent() {
    if (!this.data.canSubmit || this.data.isSubmitting) {
      return
    }

    const { name, gender, studentId, className, isEditMode, studentIndex } = this.data

    // 验证必填字段
    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    if (!gender) {
      wx.showToast({ title: '请选择性别', icon: 'none' })
      return
    }
    if (!studentId.trim()) {
      wx.showToast({ title: '请输入学号', icon: 'none' })
      return
    }
    if (!className.trim()) {
      wx.showToast({ title: '请输入班级', icon: 'none' })
      return
    }

    this.setData({ isSubmitting: true })

    // 检查学号重复
    const isDuplicate = await this.checkStudentIdDuplicate(studentId.trim(), isEditMode ? studentIndex : -1)
    if (isDuplicate) {
      this.setData({ isSubmitting: false })
      wx.showToast({
        title: '学号已存在',
        icon: 'none'
      })
      return
    }

    const studentData = {
      姓名: name.trim(),
      性别: gender,
      学号: studentId.trim(),
      班级: className.trim()
    }

    if (isEditMode) {
      this.updateStudent(studentData)
    } else {
      this.addStudent(studentData)
    }
  },

  // 新增学生
  addStudent(studentData) {
    const that = this
    wx.getStorage({
      key: 'excelData',
      success(res) {
        const students = res.data || []
        students.push(studentData)
        that.saveStudents(students, '添加成功')
      },
      fail() {
        // 首次添加
        that.saveStudents([studentData], '添加成功')
      }
    })
  },

  // 更新学生
  updateStudent(studentData) {
    const that = this
    const { studentIndex } = this.data

    wx.getStorage({
      key: 'excelData',
      success(res) {
        const students = res.data || []
        if (studentIndex >= 0 && studentIndex < students.length) {
          // 获取旧学号，用于更新请假记录
          const oldStudentId = students[studentIndex].学号
          students[studentIndex] = studentData

          // 如果学号变更，需要更新请假记录
          if (oldStudentId !== studentData.学号) {
            that.updateLeaveRecordsStudentId(oldStudentId, studentData)
          }

          that.saveStudents(students, '修改成功')
        } else {
          that.setData({ isSubmitting: false })
          wx.showToast({
            title: '学生不存在',
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
  },

  // 更新请假记录中的学生信息
  updateLeaveRecordsStudentId(oldStudentId, newStudentData) {
    wx.getStorage({
      key: 'leaveRecords',
      success(res) {
        const records = res.data || []
        const updatedRecords = records.map(record => {
          if (record.student && String(record.student.学号) === String(oldStudentId)) {
            return {
              ...record,
              student: {
                姓名: newStudentData.姓名,
                学号: newStudentData.学号,
                性别: newStudentData.性别,
                班级: newStudentData.班级
              }
            }
          }
          return record
        })

        wx.setStorage({
          key: 'leaveRecords',
          data: updatedRecords
        })
      }
    })
  },

  // 保存学生列表
  saveStudents(students, successMsg) {
    const that = this
    wx.setStorage({
      key: 'excelData',
      data: students,
      success() {
        wx.showToast({
          title: successMsg,
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
  }
})
