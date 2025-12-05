/**
 * 轻量级 XLSX 解析器 - 适用于微信小程序
 * 支持解析简单的 xlsx 文件
 */

// 微信小程序环境不支持 setImmediate，需要模拟实现
var setImmediate = function(callback) {
  return setTimeout(callback, 0)
}

// 将setImmediate挂载到全局对象，确保JSZip可以访问
if (typeof global !== 'undefined') {
  global.setImmediate = setImmediate
}
if (typeof window !== 'undefined') {
  window.setImmediate = setImmediate
}
if (typeof self !== 'undefined') {
  self.setImmediate = setImmediate
}
if (typeof globalThis !== 'undefined') {
  globalThis.setImmediate = setImmediate
}

const JSZip = require('./jszip.min.js')

/**
 * 解析 xlsx 文件
 * @param {ArrayBuffer} data - Excel 文件的 ArrayBuffer
 * @returns {Promise<Array>} 解析后的数据数组
 */
async function parseXlsx(data) {
  try {
    const zip = new JSZip()
    // 直接使用ArrayBuffer数据
    const contents = await zip.loadAsync(data)

    // 读取共享字符串
    let sharedStrings = []
    const sharedStringsFile = contents.file('xl/sharedStrings.xml')
    if (sharedStringsFile) {
      const sharedStringsXml = await sharedStringsFile.async('string')
      sharedStrings = parseSharedStrings(sharedStringsXml)
    }

    // 读取第一个工作表
    const sheet1File = contents.file('xl/worksheets/sheet1.xml')
    if (!sheet1File) {
      throw new Error('找不到工作表')
    }

    const sheetXml = await sheet1File.async('string')
    const rows = parseSheet(sheetXml, sharedStrings)

    // 转换为对象数组（第一行作为表头）
    if (rows.length < 2) {
      return []
    }

    const headers = rows[0]
    const result = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const obj = {}
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j]
        if (header) {
          obj[header] = row[j] || ''
        }
      }
      // 只添加非空行
      if (Object.values(obj).some(v => v !== '')) {
        result.push(obj)
      }
    }

    return result
  } catch (error) {
    console.error('解析 xlsx 失败:', error)
    throw error
  }
}

/**
 * 解析共享字符串
 */
function parseSharedStrings(xml) {
  const strings = []
  // 匹配 <t> 标签内容，处理可能的 xml:space 属性
  const regex = /<t[^>]*>([^<]*)<\/t>/g
  let match

  // 也需要处理 <si> 标签内可能有多个 <t> 的情况
  const siRegex = /<si>([\s\S]*?)<\/si>/g
  let siMatch

  while ((siMatch = siRegex.exec(xml)) !== null) {
    const siContent = siMatch[1]
    const tRegex = /<t[^>]*>([^<]*)<\/t>/g
    let tMatch
    let cellValue = ''

    while ((tMatch = tRegex.exec(siContent)) !== null) {
      cellValue += tMatch[1]
    }

    strings.push(decodeXmlEntities(cellValue))
  }

  return strings
}

/**
 * 解析工作表
 */
function parseSheet(xml, sharedStrings) {
  const rows = []

  // 匹配所有行
  const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g
  let rowMatch

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[1]
    const cells = []

    // 匹配所有单元格 - 更宽松的正则表达式
    const cellRegex = /<c\s+([^>]*)>([\s\S]*?)<\/c>/g
    let cellMatch

    // 用于填充空单元格
    let maxCol = 0
    const cellMap = {}

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const attrs = cellMatch[1]
      const cellContent = cellMatch[2]

      // 提取单元格引用 (如 A1, B2)
      const refMatch = attrs.match(/r="([A-Z]+)(\d+)"/)
      if (!refMatch) continue

      const colLetter = refMatch[1]

      // 提取类型
      const typeMatch = attrs.match(/t="([^"]*)"/)
      const cellType = typeMatch ? typeMatch[1] : ''

      // 提取值
      const valueMatch = cellContent.match(/<v>([^<]*)<\/v>/)
      const cellValue = valueMatch ? valueMatch[1] : undefined

      const colIndex = letterToColumn(colLetter) - 1
      maxCol = Math.max(maxCol, colIndex)

      let value = ''
      if (cellValue !== undefined) {
        if (cellType === 's') {
          // 共享字符串
          const idx = parseInt(cellValue)
          value = sharedStrings[idx] || ''
        } else {
          value = cellValue
        }
      }

      cellMap[colIndex] = value
    }

    // 构建行数组
    for (let i = 0; i <= maxCol; i++) {
      cells.push(cellMap[i] || '')
    }

    if (cells.length > 0) {
      rows.push(cells)
    }
  }

  return rows
}

/**
 * 将列字母转换为数字（A=1, B=2, ..., Z=26, AA=27, ...）
 */
function letterToColumn(letter) {
  let column = 0
  for (let i = 0; i < letter.length; i++) {
    column = column * 26 + (letter.charCodeAt(i) - 64)
  }
  return column
}

/**
 * 解码 XML 实体
 */
function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

module.exports = {
  parseXlsx
}
