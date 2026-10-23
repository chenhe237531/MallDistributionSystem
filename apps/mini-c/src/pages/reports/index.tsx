import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { api, ensureLogin, go } from '../../lib/api'

type Report = {
  id: string
  reportNo: string
  version: number
  status: string
  summary?: string | null
  missingItems: string[]
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
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ensureLogin()) {
      return
    }
    void api<Report[]>('/reports')
      .then(setReports)
      .catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
  }, [])

  const open = async (report: Report) => {
    setError('')
    try {
      setSelected(await api<Report>(`/reports/${report.id}`))
      try {
        setInterpretation(await api<Interpretation>(`/interpretations/report/${report.id}/latest`))
      } catch {
        setInterpretation(null)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '查看失败')
    }
  }

  return (
    <View className="page">
      <View className="section">
        <Text className="section-title">我的报告</Text>
        {error ? <Text className="error">{error}</Text> : null}
        {reports.length === 0 ? <Text className="muted">暂无报告，激活检测盒后实验室会生成报告</Text> : null}
        {reports.map((report) => (
          <View key={report.id} className="card" onClick={() => void open(report)}>
            <View className="row">
              <Text>
                {report.reportNo} · v{report.version}
              </Text>
              <Text className="tag">{report.status}</Text>
            </View>
            {report.missingItems.length > 0 ? (
              <Text className="muted">缺项：{report.missingItems.join('、')}</Text>
            ) : null}
            <Text className="muted">点击查看报告与 AI 解读</Text>
          </View>
        ))}
      </View>

      {selected ? (
        <View className="section">
          <Text className="section-title">报告详情</Text>
          <View className="card">
            <View className="row">
              <Text>{selected.reportNo}</Text>
              <Text className="tag">{selected.status}</Text>
            </View>
            <Text>{selected.summary ?? '报告已生成。'}</Text>
            <Text className="muted">
              {selected.disclaimer ?? '本报告仅用于健康风险提示，不作为临床诊断依据'}
            </Text>
          </View>

          {interpretation?.contentHidden ? (
            <View className="card">
              <Text className="muted">解读尚未发布，请稍后查看。</Text>
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
            <Text className="section-title">隐私与授权</Text>
            <Text className="muted">
              可在「我的」中随时关闭或重新开启商家/渠道查看报告的授权，关闭后渠道侧只显示报告状态。
            </Text>
            <Text className="tag" onClick={() => go('/pages/profile/index')}>
              前往设置
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}
