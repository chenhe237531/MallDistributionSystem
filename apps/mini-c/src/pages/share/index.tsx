import { useEffect, useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
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

export default function Share() {
  const token = routeParams().token ?? ''
  const [result, setResult] = useState<ShareResult | null>(null)
  const [error, setError] = useState('')

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
      <View className="hero">
        <Text className="hero-role">报告卡片</Text>
        <Text className="hero-title">报告已生成</Text>
        <Text className="hero-status">仅接收人本人登录后可打开</Text>
      </View>

      {error ? <Text className="error">{error}</Text> : null}

      {result ? (
        <View className="card">
          <View className="row">
            <Text>{result.report.reportNo}</Text>
            <Text className="tag">v{result.report.version}</Text>
          </View>
          <Text className="muted">
            发布时间：
            {result.report.publishedAt
              ? new Date(result.report.publishedAt).toLocaleString('zh-CN')
              : '—'}
          </Text>
          <Button className="btn" onClick={() => go(result.entry)}>
            查看报告与解读
          </Button>
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
