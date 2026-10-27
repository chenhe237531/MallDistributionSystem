import { useEffect, useMemo, useState } from 'react'
import { Picker, Text, View } from '@tarojs/components'
import { Button as NutButton, Input as NutInput } from '@nutui/nutui-react-taro'
import {
  BOWEL_PREP_STATUS_LABELS,
  BOWEL_PREP_STATUS_TONES,
  DOSING_SCHEME_HINTS,
  DOSING_SCHEME_LABELS,
  JOURNEY_PHASE_LABELS,
  JOURNEY_STATUS_LABELS,
  PUSH_SLOT_LABELS,
  formatShanghaiDate,
  formatShanghaiTime,
  shanghaiDateInput,
  statusLabel,
  type DosingSchemeKey,
  type JourneyPhaseKey,
} from '@mall/shared'
import { Icon } from '../../components/Icon'
import { PageToast, toast } from '../../components/feedback'
import { api, ensureLogin, go, routeParams } from '../../lib/api'

type Task = {
  id: string
  dayOffset: number
  dayOffsetLabel: string
  slot: 'morning' | 'noon' | 'evening'
  scheduledAt: string
  title: string
  body: string
  status: string
  skipReason?: string | null
}

type BowelPrep = {
  path: string | null
  orderId: string | null
  selfDrugName: string | null
  selfNote: string | null
  readyAt: string | null
  readyBy: string | null
}

type Journey = {
  id: string
  journeyNo: string
  status: string
  bowelPrepStatus: string
  dosingScheme: DosingSchemeKey
  transplantDate: string | null
  dayOffset: number | null
  dayOffsetLabel: string | null
  phase: JourneyPhaseKey
  pauseReason?: string | null
  bowelPrep: BowelPrep | null
  todayTasks: Task[]
  timeline?: Task[]
}

/** 默认建议移植日：今日（上海）+ 8 天，保证完整 7 天准备期 */
function suggestedDate(): string {
  return shanghaiDateInput(8)
}

function tomorrow(): string {
  return shanghaiDateInput(1)
}

function formatDate(value: string | null | undefined): string {
  return formatShanghaiDate(value, '待设置')
}

function formatTime(value: string): string {
  return formatShanghaiTime(value)
}

/**
 * 移植后健康助手（PRD §3.4 / §5 / §7.3）：
 * 旅程排期 → 今日三时段任务 → 清肠药双路径 → 时间线。
 */
export default function JourneyPage() {
  const params = routeParams()
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [selectedId, setSelectedId] = useState(params.id ?? '')
  const [detail, setDetail] = useState<Journey | null>(null)
  const [date, setDate] = useState(suggestedDate())
  const [scheme, setScheme] = useState<DosingSchemeKey>('morning_once')
  const [selfFormVisible, setSelfFormVisible] = useState(false)
  const [selfDrug, setSelfDrug] = useState('聚乙二醇电解质散')
  const [selfNote, setSelfNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async (preferredId?: string) => {
    const list = await api<Journey[]>('/journeys/mine')
    setJourneys(list)
    const current =
      list.find((item) => item.id === (preferredId ?? selectedId)) ??
      list.find((item) => item.status === 'active') ??
      list.find((item) => item.status === 'pending_schedule') ??
      list[0] ??
      null
    if (!current) {
      setDetail(null)
      setSelectedId('')
      return
    }
    setSelectedId(current.id)
    setDetail(await api<Journey>(`/journeys/${current.id}`))
    setScheme(current.dosingScheme)
    setDate(current.transplantDate ? current.transplantDate.slice(0, 10) : suggestedDate())
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

  const upcoming = useMemo(() => {
    if (!detail?.timeline) {
      return []
    }
    const offset = detail.dayOffset ?? -7
    return detail.timeline
      .filter((task) => task.dayOffset >= Math.max(-7, offset - 1) && task.dayOffset <= offset + 3)
      .slice(0, 15)
  }, [detail])

  const run = async (action: () => Promise<unknown>, success: string) => {
    setSaving(true)
    setError('')
    try {
      await action()
      toast(success, 'success')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败')
    } finally {
      setSaving(false)
    }
  }

  const submitSchedule = () =>
    run(
      () =>
        api(`/journeys/${detail?.id}/schedule`, {
          method: 'POST',
          data: { transplantDate: date, dosingScheme: scheme },
        }),
      detail?.status === 'paused' ? '已恢复并按新日期重建提醒' : '移植日已设置，推送计划已生成',
    )

  const pauseJourney = () =>
    run(
      () =>
        api(`/journeys/${detail?.id}/pause`, {
          method: 'POST',
          data: { reason: '用户暂停' },
        }),
      '旅程已暂停',
    )

  const platformOrder = async () => {
    if (!detail) {
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await api<{ order: { orderNo: string }; reused: boolean }>(
        `/journeys/${detail.id}/bowel-prep/platform-order`,
        { method: 'POST' },
      )
      toast(result.reused ? '已有待处理订单' : '清肠药订单已创建', 'success')
      go(`/pages/pay-result/index?orderNo=${result.order.orderNo}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '下单失败')
    } finally {
      setSaving(false)
    }
  }

  const confirmSelf = async () => {
    if (!detail) {
      return
    }
    await run(
      () =>
        api(`/journeys/${detail.id}/bowel-prep/self-confirm`, {
          method: 'POST',
          data: { drugName: selfDrug.trim() || undefined, note: selfNote.trim() || undefined },
        }),
      '已确认自购，清肠药准备完成',
    )
    setSelfFormVisible(false)
  }

  const markReady = () => run(() => api(`/journeys/${detail?.id}/bowel-prep/ready`, { method: 'POST' }), '已确认清肠药备好')
  const resetPrep = () => run(() => api(`/journeys/${detail?.id}/bowel-prep/reset`, { method: 'POST' }), '已撤销就绪状态')

  if (loading) {
    return (
      <View className="page">
        <Text className="muted">加载中…</Text>
      </View>
    )
  }

  if (journeys.length === 0) {
    return (
      <View className="page">
        <View className="empty-state">
          <View className="empty-icon">
            <Icon name="checkCircle" size={28} />
          </View>
          <Text className="empty-title">还没有健康助手</Text>
          <Text className="empty-desc">
            购买移植服务并完成支付后，健康助手会自动开通，按早、中、晚三时段推送注意事项。
          </Text>
          <View className="action-gap" />
          <NutButton type="primary" onClick={() => go('/pages/orders/index')}>
            去查看订单
          </NutButton>
        </View>
      </View>
    )
  }

  if (!detail) {
    return null
  }

  // 清肠药在移植日前均可提前准备（含排期较早的情况），移植后 2 天起不再展示
  const prepVisible =
    detail.dayOffset != null && detail.dayOffset <= 2 && detail.status !== 'cancelled'
  const prepReady = ['self_confirmed', 'ready'].includes(detail.bowelPrepStatus)
  const canSchedule = detail.status === 'pending_schedule' || detail.status === 'paused'

  return (
    <View className="page journey-page">
      <PageToast />

      {journeys.length > 1 ? (
        <View className="journey-switch">
          {journeys.map((item) => (
            <View
              key={item.id}
              className={`journey-chip ${item.id === detail.id ? 'journey-chip-active' : ''}`}
              onClick={() => {
                setSelectedId(item.id)
                setLoading(true)
                void load(item.id).finally(() => setLoading(false))
              }}
            >
              <Text className="journey-chip-no">{item.journeyNo}</Text>
              <Text className="journey-chip-sub">{JOURNEY_STATUS_LABELS[item.status] ?? item.status}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="journey-hero">
        <View className="journey-hero-top">
          <Text className="journey-hero-title">移植后健康助手</Text>
          <Text className="journey-hero-badge">{statusLabel(JOURNEY_STATUS_LABELS, detail.status)}</Text>
        </View>
        <Text className="journey-hero-phase">
          {JOURNEY_PHASE_LABELS[detail.phase] ?? detail.phase}
          {detail.dayOffsetLabel ? ` · ${detail.dayOffsetLabel}` : ''}
        </Text>
        <View className="journey-hero-meta">
          <Text>移植日：{formatDate(detail.transplantDate)}</Text>
          <Text>服药方案：{DOSING_SCHEME_LABELS[detail.dosingScheme]}</Text>
        </View>
        <Text className="journey-hero-note">
          {detail.status === 'pending_schedule'
            ? '设置移植日后，将从移植前 7 天开始每天推送早、中、晚三条提醒。'
            : detail.status === 'paused'
              ? `旅程已暂停${detail.pauseReason ? `：${detail.pauseReason}` : ''}，恢复时请重设移植日。`
              : `每日 07:30 / 12:00 / 19:30 推送注意事项，清肠药请提前备好。`}
        </Text>
      </View>

      {canSchedule ? (
        <View className="card">
          <Text className="card-title">
            {detail.status === 'paused' ? '恢复旅程' : '设置移植日'}
          </Text>
          <Text className="muted">建议移植日不早于今日 + 8 天，以完整执行 7 天准备期。</Text>
          <Picker
            mode="date"
            value={date}
            start={tomorrow()}
            onChange={(event) => setDate(String(event.detail.value))}
          >
            <View className="journey-field">
              <Text className="journey-field-label">移植日</Text>
              <Text className="journey-field-value">{date} ›</Text>
            </View>
          </Picker>
          <Text className="journey-field-label">服药方案</Text>
          <View className="journey-schemes">
            {(['morning_once', 'twice_daily'] as DosingSchemeKey[]).map((key) => (
              <View
                key={key}
                className={`journey-scheme ${scheme === key ? 'journey-scheme-active' : ''}`}
                onClick={() => setScheme(key)}
              >
                <Text className="journey-scheme-name">{DOSING_SCHEME_LABELS[key]}</Text>
                <Text className="journey-scheme-desc">{DOSING_SCHEME_HINTS[key]}</Text>
              </View>
            ))}
          </View>
          <View className="field-gap" />
          <NutButton block type="primary" loading={saving} onClick={() => void submitSchedule()}>
            {detail.status === 'paused' ? '恢复并重建提醒' : '开启健康助手'}
          </NutButton>
        </View>
      ) : null}

      {detail.status === 'active' ? (
        <View className="card">
          <View className="row">
            <Text className="card-title">今日任务</Text>
            <Text className="muted">{detail.dayOffsetLabel ?? ''}</Text>
          </View>
          {detail.todayTasks.length === 0 ? (
            <Text className="muted">今日无推送任务（准备期从移植前 7 天开始）。</Text>
          ) : (
            detail.todayTasks.map((task) => (
              <View key={task.id} className="journey-task">
                <View className="journey-task-time">
                  <Text>{PUSH_SLOT_LABELS[task.slot]}</Text>
                  <Text className="journey-task-clock">{formatTime(task.scheduledAt)}</Text>
                </View>
                <View className="journey-task-body">
                  <Text className="journey-task-title">{task.title}</Text>
                  <Text className="journey-task-desc">{task.body}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}

      {prepVisible ? (
        <View className="card">
          <View className="row">
            <Text className="card-title">清肠药物</Text>
            <Text className={`journey-tag journey-tag-${BOWEL_PREP_STATUS_TONES[detail.bowelPrepStatus] ?? 'default'}`}>
              {statusLabel(BOWEL_PREP_STATUS_LABELS, detail.bowelPrepStatus)}
            </Text>
          </View>
          <Text className="muted">
            移植前 1 天晚餐后需口服聚乙二醇电解质散 2 袋（加 2000mL 水冲开），清洁肠道至无渣清水状。
          </Text>

          {prepReady ? (
            <View className="journey-prep-ready">
              <Icon name="checkCircle" size={18} />
              <Text>
                {detail.bowelPrepStatus === 'self_confirmed'
                  ? `已确认自购${detail.bowelPrep?.selfDrugName ? `：${detail.bowelPrep.selfDrugName}` : ''}`
                  : '平台订单已确认备好'}
              </Text>
            </View>
          ) : (
            <View className="journey-prep-actions">
              <NutButton
                block
                type="primary"
                loading={saving}
                onClick={() => void platformOrder()}
              >
                从平台购买清肠药
              </NutButton>
              <NutButton
                block
                fill="outline"
                loading={saving}
                onClick={() => setSelfFormVisible((visible) => !visible)}
              >
                我已自行购买
              </NutButton>
              {detail.bowelPrepStatus === 'platform_ordered' ? (
                <NutButton block type="success" loading={saving} onClick={() => void markReady()}>
                  已收到，确认备好
                </NutButton>
              ) : null}
            </View>
          )}

          {selfFormVisible && !prepReady ? (
            <View className="journey-self-form">
              <Text className="journey-field-label">药品名称</Text>
              <NutInput
                value={selfDrug}
                placeholder="如：聚乙二醇电解质散"
                onChange={(value) => setSelfDrug(value)}
              />
              <Text className="journey-field-label">购买渠道（选填）</Text>
              <NutInput
                value={selfNote}
                placeholder="如：社区药店 / 医院药房"
                onChange={(value) => setSelfNote(value)}
              />
              <View className="field-gap" />
              <NutButton block type="primary" loading={saving} onClick={() => void confirmSelf()}>
                提交自购确认
              </NutButton>
            </View>
          ) : null}

          {prepReady ? (
            <Text className="journey-link" onClick={() => void resetPrep()}>
              撤销就绪状态
            </Text>
          ) : null}
        </View>
      ) : null}

      <View className="card">
        <View className="row">
          <Text className="card-title">推送时间线</Text>
          <Text className="muted">未来 3 天</Text>
        </View>
        {upcoming.length === 0 ? (
          <Text className="muted">设置移植日后，这里会显示每个时段将收到的提醒。</Text>
        ) : (
          upcoming.map((task) => (
            <View key={task.id} className="journey-timeline-item">
              <View className="journey-timeline-head">
                <Text className="journey-timeline-day">{task.dayOffsetLabel}</Text>
                <Text className="muted">
                  {PUSH_SLOT_LABELS[task.slot]} {formatTime(task.scheduledAt)}
                </Text>
                <Text className={`journey-status-dot journey-status-${task.status}`} />
              </View>
              <Text className="journey-timeline-title">{task.title}</Text>
              <Text className="journey-timeline-desc">{task.body}</Text>
            </View>
          ))
        )}
      </View>

      {detail.status === 'active' ? (
        <Text className="journey-link journey-link-danger" onClick={() => void pauseJourney()}>
          暂停旅程（发热 / 生理期 / 个人原因）
        </Text>
      ) : null}

      {error ? <Text className="error">{error}</Text> : null}
    </View>
  )
}
