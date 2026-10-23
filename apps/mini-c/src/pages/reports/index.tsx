import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import {
  Button as NutButton,
  Divider,
  Empty,
  Tag,
  Toast,
} from '@nutui/nutui-react-taro'
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

type DownloadResult = {
  url?: string
  pdfUrl?: string
  fileUrl?: string
}

const SECTION_LABELS: Array<[string, string]> = [
  ['metricExplanation', '指标解释'],
  ['abnormalItems', '异常项说明'],
  ['possibleFactors', '可能影响因素'],
  ['lifestyleAdvice', '生活方式建议'],
  ['retestAdvice', '复查建议'],
]

const WATERMARK_ROWS = 7
const WATERMARK_COLS = 2

function formatStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([])
  const [selected, setSelected] = useState<Report | null>(null)
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null)
  const [viewer, setViewer] = useState('')
  const [stamp, setStamp] = useState(() => formatStamp(new Date()))
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ensureLogin()) {
      return
    }
    void api<Report[]>('/reports')
      .then(setReports)
      .catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
    void api<{ name: string; realName: string | null }>('/customers/me')
      .then((me) => setViewer(me.realName || me.name || '当前用户'))
      .catch(() => setViewer('当前用户'))
    const timer = setInterval(() => setStamp(formatStamp(new Date())), 30_000)
    return () => clearInterval(timer)
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

  const download = async () => {
    if (!selected) {
      return
    }
    setDownloading(true)
    try {
      const data = await api<DownloadResult>(`/reports/${selected.id}/download`)
      const fileUrl = data.url ?? data.pdfUrl ?? data.fileUrl
      if (fileUrl) {
        window.open(fileUrl, '_blank')
        Toast.show('report-toast', { title: '已开始下载报告 PDF', icon: 'success' })
      } else {
        Toast.show('report-toast', { title: '报告文件尚未生成' })
      }
    } catch (cause) {
      Toast.show('report-toast', {
        title: cause instanceof Error ? cause.message : '下载失败',
      })
    } finally {
      setDownloading(false)
    }
  }

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
            {viewer || '当前用户'} · {stamp}
          </Text>
        ))}
      </View>
      <Toast id="report-toast" />
      <View className="section">
        <Text className="section-title">我的报告</Text>
        {error ? <Text className="error">{error}</Text> : null}
        {reports.length === 0 ? (
          <Empty description="暂无报告，激活检测盒后实验室会生成报告" />
        ) : null}
        {reports.map((report) => (
          <View key={report.id} className="card" onClick={() => void open(report)}>
            <View className="row">
              <Text className="card-title">
                {report.reportNo} · v{report.version}
              </Text>
              <Tag type="primary">{report.status}</Tag>
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
              <Text className="card-title">{selected.reportNo}</Text>
              <Tag type="primary">{selected.status}</Tag>
            </View>
            <Text>{selected.summary ?? '报告已生成。'}</Text>
            <Divider contentPosition="left" />
            <Text className="muted">
              {selected.disclaimer ?? '本报告仅用于健康风险提示，不作为临床诊断依据'}
            </Text>
            <View className="field-gap" />
            <NutButton
              block
              size="small"
              type="primary"
              fill="outline"
              loading={downloading}
              onClick={() => void download()}
            >
              下载报告 PDF
            </NutButton>
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
                    <Tag plain type="primary">
                      {label}
                    </Tag>
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
            <View className="field-gap" />
            <NutButton size="small" type="primary" fill="outline" onClick={() => go('/pages/profile/index')}>
              前往设置
            </NutButton>
          </View>
        </View>
      ) : null}
    </View>
  )
}
