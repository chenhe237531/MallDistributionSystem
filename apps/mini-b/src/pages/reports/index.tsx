import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'
import { api, ensureLogin } from '../../lib/api'

type Report = {
  id: string
  reportNo: string
  version: number
  status: string
  orderId?: string | null
  missingItems: string[]
  summary?: string | null
  contentHidden?: boolean
  disclaimer?: string
}

type Interpretation = {
  id: string
  status: string
  contentHidden?: boolean
  sections?: Record<string, string>
  disclaimer?: string
}

const SECTION_LABELS: Array<[string, string]> = [
  ['metricExplanation', '指标解释'],
  ['abnormalItems', '异常项说明'],
  ['possibleFactors', '可能影响因素'],
  ['lifestyleAdvice', '生活方式建议'],
  ['retestAdvice', '复查建议'],
]

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([])
  const [selected, setSelected] = useState<Report | null>(null)
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null)
  const [receiverPhone, setReceiverPhone] = useState('')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [forwarding, setForwarding] = useState(false)

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void api<Report[]>('/reports')
      .then(setReports)
      .catch((cause) => {
        void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
      })
  })

  const open = async (id: string) => {
    try {
      setSelected(await api<Report>(`/reports/${id}`))
      setMessage('')
      setNotice('')
      try {
        setInterpretation(await api<Interpretation>(`/interpretations/report/${id}/latest`))
      } catch {
        setInterpretation(null)
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '查看失败')
    }
  }

  const forward = async () => {
    if (!selected) {
      return
    }
    if (receiverPhone.trim().length !== 11) {
      setMessage('请填写客户 11 位手机号')
      return
    }
    setForwarding(true)
    setMessage('')
    setNotice('')
    try {
      const result = await api<{ token: string; entry: string }>('/report-shares', {
        method: 'POST',
        data: { reportId: selected.id, receiverPhone: receiverPhone.trim() },
      })
      setNotice(`转发卡片已生成。客户登录后打开 ${result.entry} 即可查看，第三人无法打开。`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '转发失败')
    } finally {
      setForwarding(false)
    }
  }

  return (
    <View className="page">
      <View className="section">
        <Text className="section-title">本店报告</Text>
        {reports.length === 0 ? <Text className="muted">暂无报告</Text> : null}
        {reports.map((report) => (
          <View key={report.id} className="card" onClick={() => void open(report.id)}>
            <View className="row">
              <Text>
                {report.reportNo} · v{report.version}
              </Text>
              <Text className="tag">{report.status}</Text>
            </View>
            {report.missingItems.length > 0 ? (
              <Text className="muted">缺项：{report.missingItems.join('、')}</Text>
            ) : null}
            <Text className="muted">点击查看报告与解读</Text>
          </View>
        ))}
      </View>

      {message ? <Text className="error">{message}</Text> : null}
      {selected ? (
        <View className="section">
          <Text className="section-title">报告详情</Text>
          <View className="card">
            <View className="row">
              <Text>{selected.reportNo}</Text>
              <Text className="tag">{selected.status}</Text>
            </View>
            {selected.contentHidden ? (
              <Text className="muted">客户已关闭报告授权，仅显示报告状态。</Text>
            ) : (
              <Text>{selected.summary ?? '报告已生成，请结合指标查看。'}</Text>
            )}
            <Text className="muted">
              {selected.disclaimer ?? '本报告仅用于健康风险提示，不作为临床诊断依据'}
            </Text>
          </View>

          {interpretation?.contentHidden ? (
            <View className="card">
              <Text className="muted">解读尚未发布，或客户已关闭授权。</Text>
            </View>
          ) : null}
          {interpretation?.sections ? (
            <View className="card">
              <Text className="section-title">AI 解读</Text>
              {SECTION_LABELS.map(([key, label]) =>
                interpretation.sections?.[key] ? (
                  <View key={key} className="interpretation-block">
                    <Text className="tag">{label}</Text>
                    <Text>{interpretation.sections[key]}</Text>
                  </View>
                ) : null,
              )}
              <Text className="muted">{interpretation.disclaimer ?? ''}</Text>
            </View>
          ) : null}

          <View className="card">
            <Text className="section-title">转发报告卡片</Text>
            <Text className="muted">
              仅订单客户本人登录后可打开；通知与卡片不包含指标数值、异常项或结论。
            </Text>
            <Input
              className="input"
              type="number"
              maxlength={11}
              value={receiverPhone}
              placeholder="客户手机号"
              onInput={(event) => setReceiverPhone(event.detail.value)}
            />
            <Button className="btn" loading={forwarding} onClick={() => void forward()}>
              生成转发卡片
            </Button>
            {notice ? <Text className="muted">{notice}</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  )
}
