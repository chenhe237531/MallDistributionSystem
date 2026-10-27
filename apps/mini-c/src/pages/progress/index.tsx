import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import {
  Button as NutButton,
  Input as NutInput,
} from '@nutui/nutui-react-taro'
import { PageToast, toast } from '../../components/feedback'
import { Icon } from '../../components/Icon'
import { ServicePanel } from '../../components/ServicePanel'
import { StepFlow } from '../../components/StepFlow'
import { api, ensureLogin, go, routeParams } from '../../lib/api'
import { MAILING_GUIDE } from '../../lib/content'
import {
  RELATIONSHIP_LABELS,
  SAMPLE_EVENT_LABELS,
  SAMPLE_STATUS_LABELS,
  isQuestionnaireDone,
  type SampleRecord,
} from '../../lib/sample'

function formatTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '—'
}

export default function Progress() {
  const params = routeParams()
  const [samples, setSamples] = useState<SampleRecord[]>([])
  const [selectedId, setSelectedId] = useState(params.sampleId ?? '')
  const [trackingNo, setTrackingNo] = useState('')
  const [serviceVisible, setServiceVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const list = await api<SampleRecord[]>('/samples/me')
    setSamples(list)
    if (!selectedId && list.length > 0) {
      setSelectedId(list[0].id)
    }
  }

  useEffect(() => {
    if (!ensureLogin()) {
      return
    }
    void load()
      .catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = samples.find((item) => item.id === selectedId) ?? samples[0] ?? null
  const questionnaireDone = selected ? isQuestionnaireDone(selected) : false
  const mailedEvent = selected?.events.find((event) => event.type === 'mailed')

  const mailSample = async () => {
    if (!selected) {
      return
    }
    if (!trackingNo.trim()) {
      setError('请填写寄回运单号')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api(`/samples/${selected.id}/mail`, {
        method: 'POST',
        data: { trackingNo: trackingNo.trim() },
      })
      toast('运单号已登记', 'success')
      setTrackingNo('')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登记失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View className="page">
        <Text className="muted">加载中…</Text>
      </View>
    )
  }

  if (samples.length === 0) {
    return (
      <View className="page">
        <View className="empty-state">
          <View className="empty-icon">
            <Icon name="box" size={28} />
          </View>
          <Text className="empty-title">还没有检测样本</Text>
          <Text className="empty-desc">
            购买检测盒后，使用盒内样本编号完成绑定，即可在此查看检测进度。
          </Text>
          <View className="action-gap" />
          <NutButton type="primary" onClick={() => go('/pages/activate/index')}>
            去绑定样本
          </NutButton>
        </View>
      </View>
    )
  }

  if (!selected) {
    return null
  }

  const canMail =
    (selected.status === 'activated' || selected.status === 'pending_mail') && questionnaireDone
  const needQuestionnaire = selected.status === 'activated' && !questionnaireDone

  return (
    <View className="page">
      <PageToast />

      {samples.length > 1 ? (
        <View className="sample-switch">
          {samples.map((item) => (
            <View
              key={item.id}
              className={`sample-chip ${item.id === selected.id ? 'sample-chip-active' : ''}`}
              role="button"
              aria-label={item.sampleNo}
              onClick={() => {
                setSelectedId(item.id)
                setTrackingNo('')
                setError('')
              }}
            >
              <Text className="sample-chip-no">{item.sampleNo}</Text>
              <Text className="sample-chip-sub">
                {RELATIONSHIP_LABELS[item.relationship ?? 'self'] ?? '受检人'} ·{' '}
                {SAMPLE_STATUS_LABELS[item.status]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="section">
        <StepFlow status={selected.status} questionnaireDone={questionnaireDone} />
      </View>

      <View className="card">
        <View className="row">
          <Text className="card-title">{selected.sampleNo}</Text>
          <Text>{SAMPLE_STATUS_LABELS[selected.status]}</Text>
        </View>
        <Text className="muted">盒码：{selected.boxCode?.code ?? '—'}</Text>
        <Text className="muted">
          {selected.boxCode?.productName ? `商品：${selected.boxCode.productName} · ` : ''}
          采样时间：{formatTime(selected.sampledAt)}
        </Text>
        {selected.remark ? <Text className="muted">备注：{selected.remark}</Text> : null}
      </View>

      {selected.status === 'abnormal' ? (
        <View className="alert-strip alert-strip-danger">
          <Text>
            样本异常{selected.events.find((event) => event.type.includes('abnormal'))?.note
              ? `：${selected.events.find((event) => event.type.includes('abnormal'))?.note}`
              : '，请联系客服处理'}
          </Text>
          <Text className="alert-strip-action" onClick={() => setServiceVisible(true)}>
            联系客服
          </Text>
        </View>
      ) : null}

      {selected.status === 'voided' ? (
        <View className="alert-strip alert-strip-danger">
          <Text>该样本已作废，如需重新采样请联系客服。</Text>
          <Text className="alert-strip-action" onClick={() => setServiceVisible(true)}>
            联系客服
          </Text>
        </View>
      ) : null}

      {needQuestionnaire ? (
        <View className="alert-strip">
          <Text>请填写健康问卷，提交后即可寄回样本。</Text>
          <Text
            className="alert-strip-action"
            onClick={() => go(`/pages/questionnaire/index?sampleId=${selected.id}`)}
          >
            去填写
          </Text>
        </View>
      ) : null}

      {selected.status === 'published' ? (
        <View className="card">
          <Text className="card-title">报告已发布</Text>
          <Text className="muted">您的检测报告已生成，可在「我的报告」中查看。</Text>
          <View className="field-gap" />
          <NutButton block type="primary" onClick={() => go('/pages/reports/index')}>
            查看报告
          </NutButton>
        </View>
      ) : null}

      {canMail ? (
        <View className="card">
          <Text className="card-title">样本寄回</Text>
          {MAILING_GUIDE.map((line) => (
            <Text key={line} className="muted">
              · {line}
            </Text>
          ))}
          <View className="mail-form">
            <View className="mail-form-input">
              <NutInput
                value={trackingNo}
                placeholder="请输入寄回运单号"
                clearable
                onChange={(value) => setTrackingNo(value)}
              />
            </View>
            <NutButton
              type="primary"
              size="small"
              loading={submitting}
              onClick={() => void mailSample()}
            >
              登记
            </NutButton>
          </View>
        </View>
      ) : null}

      {selected.status === 'in_transit' ? (
        <View className="card">
          <Text className="card-title">物流信息</Text>
          <View className="row">
            <Text>运单号</Text>
            <Text>{selected.trackingNo ?? '未登记'}</Text>
          </View>
          <View className="row">
            <Text>寄出时间</Text>
            <Text>{formatTime(mailedEvent?.createdAt)}</Text>
          </View>
          <Text className="muted">物流轨迹查询即将上线，如需了解运输进度请联系客服。</Text>
        </View>
      ) : null}

      {selected.status === 'received_by_lab' ||
      selected.status === 'testing' ||
      selected.status === 'report_generated' ? (
        <View className="card">
          <Text className="card-title">实验室处理中</Text>
          <Text className="muted">
            实验室已收到样本，正在按流程完成检测与报告生成，请耐心等待。
          </Text>
        </View>
      ) : null}

      <View className="card">
        <Text className="card-title">进度记录</Text>
        {selected.events.length === 0 ? (
          <Text className="muted">样本绑定后将在此显示各节点完成时间。</Text>
        ) : (
          <View className="timeline">
            {selected.events.map((event, index) => (
              <View key={event.id} className="timeline-item">
                <View className="timeline-line" />
                <View
                  className={`timeline-dot ${index === selected.events.length - 1 ? 'timeline-dot-active' : ''}`}
                />
                <View className="timeline-body">
                  <Text className="timeline-title">
                    {SAMPLE_EVENT_LABELS[event.type] ?? event.type}
                  </Text>
                  <Text className="timeline-time">{formatTime(event.createdAt)}</Text>
                  {event.note ? <Text className="timeline-note">{event.note}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {error ? <Text className="error">{error}</Text> : null}

      <ServicePanel visible={serviceVisible} onClose={() => setServiceVisible(false)} />
    </View>
  )
}
