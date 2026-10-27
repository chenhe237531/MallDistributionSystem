import { useMemo } from 'react'
import { View } from '@tarojs/components'
import qrcode from 'qrcode-generator'

type QrCodeProps = {
  /** 二维码内容 */
  text: string
  /** 显示尺寸（px） */
  size?: number
  /** 深色模块颜色 */
  color?: string
}

/** 纯前端二维码：把 QR 矩阵渲染成 View 网格，H5 与小程序均可显示 */
export function QrCode({ text, size = 190, color = '#1f2430' }: QrCodeProps) {
  const { cells, count, cellSize } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    const moduleCount = qr.getModuleCount()
    const matrix: boolean[] = []
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        matrix.push(qr.isDark(row, col))
      }
    }
    return {
      cells: matrix,
      count: moduleCount,
      cellSize: Math.floor((size / moduleCount) * 100) / 100,
    }
  }, [text, size])

  return (
    <View
      className="qr-code"
      style={{ width: `${size}px`, height: `${size}px`, padding: '6px', background: '#fff' }}
    >
      {cells.map((dark, index) => (
        <View
          key={index}
          className="qr-cell"
          style={{
            width: `${cellSize}px`,
            height: `${cellSize}px`,
            background: dark ? color : 'transparent',
          }}
        />
      ))}
    </View>
  )
}
