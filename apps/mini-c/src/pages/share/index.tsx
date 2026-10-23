import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { Button as NutButton, Tag } from '@nutui/nutui-react-taro'
import { api, ensureLogin, go, routeParams } from '../../lib/api'

type ShareResult = {
  valid: boolean
  report: {
    id: string
    reportNo: string
    version: number
    status: string
    publishedAt: string | null
  }
  entry: string
}

const WATERMARK_ROWS = 7
const WATERMARK_COLS = 2

function formatStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function Share() {
  const token = routeParams().token ?? ''
  const [result, setResult] = useState<ShareResult | null>(null)
  const [stamp, setStamp] = useState(() => formatStamp(new Date()))
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setStamp(formatStamp(new Date())), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!ensureLogin()) {
      return
    }
    if (!token) {
      setError('分享链接缺少凭证')
      return
    }
    void api<ShareResult>(`/report-shares/${token}`)
      .then(setResult)
      .catch((cause) => setError(cause instanceof Error ? cause.message : '链接无效'))
  }, [token])

  return (
    <View className="page">
      <View className="watermark-layer">
        {Array.from({ length: WATERMARK_ROWS * WATERMARK_COLS }, (_, index) => (
          <Text
            key={index}
            className="watermark-item"
            style={{
              left: `${(index % WATERMARK_COLS) * 50 + 8}%`,
              top: `${Math.floor(index / WATERMARK_COLS) * 110 - 40}px`,
            }}
          >
            授权访客 · {stamp}
          </Text>
        ))}
      </View>
      <View className="hero">
        <Text className="hero-role">报告卡片</Text>
        <Text className="hero-title">报告已生成</Text>
        <Text className="hero-status">仅接收人本人登录后可打开</Text>
      </View>

      {error ? <Text className="error">{error}</Text> : null}

      {result ? (
        <View className="card" style={{ marginTop: '12px' }}>
          <View className="row">
            <Text className="card-title">{result.report.reportNo}</Text>
            <Tag plain type="primary">
              v{result.report.version}
            </Tag>
          </View>
          <Text className="muted">
            发布时间：
            {result.report.publishedAt
              ? new Date(result.report.publishedAt).toLocaleString('zh-CN')
              : '—'}
          </Text>
          <View className="field-gap" />
          <NutButton block type="primary" onClick={() => go(result.entry)}>
            查看报告与解读
          </NutButton>
        </View>
      ) : null}

      <View className="notice">
        <Text>
          为保护隐私，卡片不包含指标数值、异常项或结论；第三人打开将被拒绝并记录。
        </Text>
      </View>
    </View>
  )
}
