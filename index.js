// 引入fs模块
const fs = require('fs')

// 定义csf文件的路径
const csfFilePath = 'ra2.csf'
// 定义json文件的路径
const jsonFilePath = 'ra2.json'

// 定义csf文件的结构
const csfFileHeaderSize = 0x18 // 文件头的字节数
const csfLabelHeaderSize = 0x0c // 标签头的字节数
const csfStringHeaderSize = 0x08 // 字符串头的字节数
const csfStringExtraSize = 0x04 // 字符串头扩展的字节数

// 定义一个函数，用于读取一个无符号整数
function readUInt(buffer, offset, size) {
  // 根据大小选择合适的方法
  switch (size) {
    case 1:
      return buffer.readUInt8(offset)
    case 2:
      return buffer.readUInt16LE(offset)
    case 4:
      return buffer.readUInt32LE(offset)
    default:
      throw new Error('Invalid size')
  }
}

const cp1252_Map = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030,
  0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d,
  0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e,
  0x178,
]

// 定义一个函数，用于读取一个字符串
function readString(buffer, offset, length, encoding) {
  // 根据编码选择合适的方法
  switch (encoding) {
    case 'ascii':
      return buffer.toString('ascii', offset, offset + length)
    case 'utf16le':
      return buffer.toString('utf16le', offset, offset + length * 2)
    case 'special':
      const newBuffer = Buffer.from(Buffer.from(buffer, offset, length * 2))
      // let sp = false
      for (let i = 0; i < newBuffer.length; i += 2) {
        newBuffer[i] = ~newBuffer[i]
        newBuffer[i + 1] = ~newBuffer[i + 1]
        // win1252转unicode
        if (
          newBuffer[i + 1] === 0x00 &&
          newBuffer[i] >= 0x80 &&
          newBuffer[i] <= 0x9f
        ) {
          const newVar = cp1252_Map[newBuffer[i] - 0x80]
          newBuffer[i + 1] = newVar >> 8
          newBuffer[i] = newVar & 0xff

          // sp = true
        }
      }
      // if (sp) {
      //   console.log(newBuffer.toString('utf16le'), '™')
      // }
      return newBuffer.toString('utf16le')
    default:
      throw new Error('Invalid encoding')
  }
}

// 定义一个函数，用于读取一个csf文件
function readCSFFile(filePath) {
  const csfObject = {}
  // 打开文件
  const fd = fs.openSync(filePath, 'r')
  // 读取文件头
  const fileHeaderBuffer = Buffer.alloc(csfFileHeaderSize)
  fs.readSync(fd, fileHeaderBuffer, 0, csfFileHeaderSize, 0)
  // 解析文件头
  const fileID = readString(fileHeaderBuffer, 0, 4, 'ascii') // 文件标识符，应为' FSC'
  const version = readUInt(fileHeaderBuffer, 4, 4) // 文件版本，应为3
  const numLabels = readUInt(fileHeaderBuffer, 8, 4) // 文件中的标签数
  const numStrings = readUInt(fileHeaderBuffer, 0x0c, 4) // 文件中的字符串对数
  const languageCode = readUInt(fileHeaderBuffer, 0x014, 4) // 语言代码
  // 检查文件头是否有效
  if (fileID !== ' FSC') {
    console.error('Invalid file ID')
    return
  }
  if (version !== 3) {
    console.error('Unsupported file version')
    return
  }
  // 输出文件头信息
  // console.log('File ID:', fileID)
  // console.log('File version:', version)
  // console.log('Number of labels:', numLabels)
  // console.log('Number of Strings:', numStrings)
  // console.log('Language Code:', languageCode)
  // 读取标签块
  let labelOffset = csfFileHeaderSize // 标签块的偏移量
  for (let i = 0; i < numLabels; i++) {
    // 读取标签头
    const labelHeaderBuffer = Buffer.alloc(csfLabelHeaderSize)
    fs.readSync(fd, labelHeaderBuffer, 0, csfLabelHeaderSize, labelOffset)
    // 解析标签头
    const labelID = readString(labelHeaderBuffer, 0, 4, 'ascii') // 标签的ID，应为' LBL'
    const numStrings = readUInt(labelHeaderBuffer, 4, 4) // 标签下的字符串数
    const labelNameLength = readUInt(labelHeaderBuffer, 8, 4) // 标签的名称长度
    // 检查标签头是否有效
    if (labelID !== ' LBL') {
      console.error('Invalid label ID')
      return
    }
    // 输出标签头信息
    // console.log('Label ID:', labelID)
    // console.log('Number of strings:', numStrings)
    // console.log('Label name length:', labelNameLength)
    // 读取标签名称
    const labelNameBuffer = Buffer.alloc(labelNameLength)
    fs.readSync(
      fd,
      labelNameBuffer,
      0,
      labelNameLength,
      labelOffset + csfLabelHeaderSize
    )
    // 解析标签名称
    const labelName = readString(labelNameBuffer, 0, labelNameLength, 'ascii') // 标签的名称
    // 输出标签名称
    // console.log('Label name:', labelName)
    // 读取字符串块
    let stringOffset = labelOffset + csfLabelHeaderSize + labelNameLength // 字符串块的偏移量
    for (let j = 0; j < numStrings; j++) {
      // 读取字符串头
      const stringHeaderBuffer = Buffer.alloc(csfStringHeaderSize)
      fs.readSync(fd, stringHeaderBuffer, 0, csfStringHeaderSize, stringOffset)
      // 解析字符串头
      const stringID = readString(stringHeaderBuffer, 0, 4, 'ascii') // 字符串的ID，应为' RTS'或'WRTS'
      const stringLength = readUInt(stringHeaderBuffer, 4, 4) // 字符串长度
      // 输出字符串头信息
      // console.log('String ID:', stringID)
      // console.log('String length:', stringLength)
      // 读取字符串内容
      const stringContentBuffer = Buffer.alloc(stringLength * 2)
      fs.readSync(
        fd,
        stringContentBuffer,
        0,
        stringLength * 2,
        stringOffset + csfStringHeaderSize
      )
      // 解析字符串内容
      const stringContent = readString(
        stringContentBuffer,
        0,
        stringLength,
        'special'
      )
      // 输出字符串内容
      // console.log('String content:', stringContent)
      csfObject[labelName] = {}
      csfObject[labelName]['Value'] = stringContent
      // 更新字符串块的偏移量
      stringOffset += csfStringHeaderSize + stringLength * 2
      // 如果有额外内容
      if (stringID === 'WRTS') {
        // 读取额外内容长度
        const extraValueLengthBuffer = Buffer.alloc(csfStringExtraSize)
        fs.readSync(
          fd,
          extraValueLengthBuffer,
          0,
          csfStringExtraSize,
          stringOffset
        )
        // 解析额外内容长度
        const extraValueLength = readUInt(extraValueLengthBuffer, 0, 4)
        // 读取额外内容
        const extraValueBuffer = Buffer.alloc(extraValueLength)
        fs.readSync(
          fd,
          extraValueBuffer,
          0,
          extraValueLength,
          stringOffset + extraValueLength
        )
        // 解析额外内容
        const extraValue = readString(
          extraValueBuffer,
          0,
          extraValueLength,
          'ascii'
        )
        // 输出额外内容
        // console.log('Extra content:', extraValue)
        csfObject[labelName]['Extra'] = extraValue
        // 更新字符串块的偏移量
        stringOffset += csfStringExtraSize + extraValueLength
      }
    }
    // 更新标签块的偏移量
    labelOffset = stringOffset
  }
  return csfObject
}

// 写入CSF文件
function writeCSFFile(csfObject, filePath) {
  const bufList = []
  const keys = Object.keys(csfObject)

  // console.log(keys.length)

  // 构建文件头
  const fileHeaderBuffer = Buffer.alloc(csfFileHeaderSize)
  // 填充文件头
  const fileID = ' FSC' // 文件标识符，应为' FSC'
  const version = 3 // 文件版本，应为3
  const numLabels = keys.length // 文件中的标签数
  const numStrings = keys.length // 文件中的字符串对数
  const languageCode = 9 // 语言代码

  fileHeaderBuffer.write(fileID, 0, 4, 'ascii')
  fileHeaderBuffer.writeUInt16LE(version, 0x04)
  fileHeaderBuffer.writeUInt16LE(numLabels, 0x08)
  fileHeaderBuffer.writeUInt16LE(numStrings, 0x0c)
  fileHeaderBuffer.writeUInt16LE(languageCode, 0x14)
  // 填入总Buffer
  bufList.push(fileHeaderBuffer)

  keys.forEach((label) => {
    // 负载str对象
    strObj = csfObject[label]
    // 构建标签头
    const labelHeaderBuffer = Buffer.alloc(csfLabelHeaderSize)
    // 填充标签头
    const labelID = ' LBL' // 标签的ID，应为' LBL'
    const numStrings = 1 // 标签下的字符串数，在这里为1
    const labelNameLength = label.length // 标签的名称长度

    labelHeaderBuffer.write(labelID, 0, 4, 'ascii')
    labelHeaderBuffer.writeUInt16LE(numStrings, 0x04)
    labelHeaderBuffer.writeUInt16LE(labelNameLength, 0x08)

    // 构建标签名
    const labelNameBuffer = Buffer.alloc(labelNameLength)
    // 填充标签名
    labelNameBuffer.write(label, 0, label.length, 'ascii')
    // 填入总Buffer
    bufList.push(labelHeaderBuffer)
    bufList.push(labelNameBuffer)

    // 构建字符串头
    const stringHeaderBuffer = Buffer.alloc(csfStringHeaderSize)
    // 填充字符串头
    const stringID = strObj['Extra'] === undefined ? ' RTS' : 'WRTS' // 字符串的ID，应为' RTS'或'WRTS'
    const stringLength = strObj['Value'].length // 字符串长度

    stringHeaderBuffer.write(stringID, 0, 4, 'ascii')
    stringHeaderBuffer.writeUInt16LE(stringLength, 0x04)

    // 构建字符串内容
    const stringContentBuffer = Buffer.alloc(stringLength * 2)
    stringContentBuffer.write(strObj['Value'], 0, stringLength * 2, 'utf16le')

    for (let i = 0; i < stringContentBuffer.length; i += 2) {
      let sp = false
      const testValue =
        (stringContentBuffer[i + 1] << 8) | stringContentBuffer[i]
      const testIndex = cp1252_Map.indexOf(testValue)
      if (testIndex > -1) {
        stringContentBuffer[i + 1] = 0
        stringContentBuffer[i] = testIndex + 0x80
        sp = true
      }
      stringContentBuffer[i] = ~stringContentBuffer[i]
      stringContentBuffer[i + 1] = ~stringContentBuffer[i + 1]
    }

    // 填入总Buffer
    bufList.push(stringHeaderBuffer)
    bufList.push(stringContentBuffer)

    if (stringID === 'WRTS') {
      // 额外内容
      const extraValueLengthBuffer = Buffer.alloc(csfStringExtraSize)
      const extraValueLength = strObj['Extra'].length
      extraValueLengthBuffer.writeUInt16LE(extraValueLength, 0)

      const extraValueBuffer = Buffer.alloc(extraValueLength)
      extraValueBuffer.write(strObj['Extra'], 0, extraValueLength, 'ascii')

      bufList.push(extraValueLengthBuffer)
      bufList.push(extraValueBuffer)
    }
  })

  fs.writeFileSync(filePath, Buffer.concat(bufList))
}

// 调用函数，读取csf文件，输出JSON文件
// fs.writeFileSync("ra2.zh_Hant.csf", JSON.stringify(readCSFFile("ra2.zh_Hant.json")))
// fs.writeFileSync("ra2md.zh_Hant.csf", JSON.stringify(readCSFFile("ra2md.zh_Hant.json")))

// fs.writeFileSync("ra2.en.csf", JSON.stringify(readCSFFile("ra2.en.json")))
// fs.writeFileSync("ra2md.en.csf", JSON.stringify(readCSFFile("ra2md.en.json")))

// fs.writeFileSync("ra2.zh_Hans.csf", JSON.stringify(readCSFFile("ra2.zh_Hans.json")))
// fs.writeFileSync("ra2md.zh_Hans.csf", JSON.stringify(readCSFFile("ra2md.zh_Hans.json")))

writeCSFFile(JSON.parse(fs.readFileSync('ra2.zh_Hant.json')), 'ra2.zh_Hant.csf')
