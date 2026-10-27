import { useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Picker, Text, View } from '@tarojs/components'
import {
  Button as NutButton,
  Empty,
  Tag,
} from '@nutui/nutui-react-taro'
import { PageToast, toast } from '../../components/feedback'
import {
  BOWEL_PREP_STATUS_LABELS,
  BOWEL_PREP_STATUS_TONES,
  DOSING_SCHEME_LABELS,
  JOURNEY_PHASE_LABELS,
  JOURNEY_STATUS_LABELS,
  JOURNEY_STATUS_TONES,
  formatShanghaiDate,
  shanghaiDateInput,
  statusLabel,
} from '@mall/shared'
import { Icon } from '../../components/Icon'
import { api, ensureLogin, go } from '../../lib/api'
import { useTheme } from '../../lib/theme'

type Customer = { id: string; name: string; phone: string }

type Journey = {
  id: string
  journeyNo: string
  status: string
  bowelPrepStatus: string
  dosingScheme: 'morning_once' | 'twice_daily'
  transplantDate: string | null
  dayOffsetLabel: string | null
  phase: keyof typeof JOURNEY_PHASE_LABELS
  customer: Customer | null
  bowelPrep: { selfDrugName?: string | null; selfNote?: string | null; readyBy?: string | null } | null
  pauseReason?: string | null
}

type Overview = { total: number; active: number; pendingSchedule: number; prepAlerts: number }


function suggestedDate(): string {
  return shanghaiDateInput(8)
}

function tomorrow(): string {
  return shanghaiDateInput(1)
}

function formatDate(value: string | null): string {
  return formatShanghaiDate(value, '待设置')
}

/**
 * 商家端：客户健康助手旅程跟进（PRD §7.1）。
 * 列表支持清肠预警筛选、代设移植日与代确认清肠药备好。
 */
export default function Journeys() {
  const { themeClass } = useTheme()
  const [items, setItems] = useState<Journey[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [filter, setFilter] = useState<'all' | 'alert'>('all')
  const [editingId, setEditingId] = useState('')
  const [date, setDate] = useState(suggestedDate())
  const [submitting, setSubmitting] = useState('')

  const load = async (nextFilter: 'all' | 'alert' = filter) => {
    const [list, stats] = await Promise.all([
      api<Journey[]>(`/journeys${nextFilter === 'alert' ? '?alert=1' : ''}`),
      api<Overview>('/journeys/overview'),
    ])
    setItems(list)
    setOverview(stats)
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => {
      toast(cause instanceof Error ? cause.message : '加载失败', 'fail')
    })
  })

  const alerts = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === 'active' &&
          ['none', 'platform_ordered'].includes(item.bowelPrepStatus),
      ).length,
    [items],
  )

  const switchFilter = (next: 'all' | 'alert') => {
    setFilter(next)
    setEditingId('')
    void load(next).catch((cause) => {
      toast(cause instanceof Error ? cause.message : '加载失败', 'fail')
    })
  }

  const markReady = async (journey: Journey) => {
    setSubmitting(journey.id)
    try {
      await api(`/journeys/${journey.id}/bowel-prep/ready`, { method: 'POST' })
      toast('已代客户确认清肠药备好', 'success')
      await load()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '操作失败', 'fail')
    } finally {
      setSubmitting('')
    }
  }

  const submitSchedule = async (journey: Journey) => {
    setSubmitting(journey.id)
    try {
      await api(`/journeys/${journey.id}/schedule`, {
        method: 'POST',
        data: { transplantDate: date },
      })
      toast('移植日已设置，推送计划已生成', 'success')
      setEditingId('')
      await load()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '设置失败', 'fail')
    } finally {
      setSubmitting('')
    }
  }

  return (
    <View className={`page page-with-tabbar ${themeClass}`}>
      <PageToast />

      <View className="journey-stats">
        <View className="journey-stat">
          <Text className="journey-stat-value">{overview?.active ?? 0}</Text>
          <Text className="journey-stat-label">进行中</Text>
        </View>
        <View className="journey-stat">
          <Text className="journey-stat-value">{overview?.pendingSchedule ?? 0}</Text>
          <Text className="journey-stat-label">待排期</Text>
        </View>
        <View className="journey-stat journey-stat-warn">
          <Text className="journey-stat-value">{overview?.prepAlerts ?? 0}</Text>
          <Text className="journey-stat-label">清肠待办</Text>
        </View>
      </View>

      <View className="journey-filters">
        <View
          className={`journey-filter ${filter === 'all' ? 'journey-filter-active' : ''}`}
          onClick={() => switchFilter('all')}
        >
          <Text>全部客户</Text>
        </View>
        <View
          className={`journey-filter ${filter === 'alert' ? 'journey-filter-active' : ''}`}
          onClick={() => switchFilter('alert')}
        >
          <Text>清肠预警 {alerts > 0 ? `(${alerts})` : ''}</Text>
        </View>
      </View>

      {items.length === 0 ? (
        <Empty description={filter === 'alert' ? '暂无清肠预警客户' : '暂无客户旅程'} />
      ) : null}

      {items.map((journey) => (
        <View key={journey.id} className="card journey-card">
          <View className="row">
            <View className="journey-card-head">
              <Text className="journey-card-name">
                {journey.customer?.name ?? '客户'}
              </Text>
              <Text className="muted">{journey.customer?.phone ?? ''}</Text>
            </View>
            <Tag type={JOURNEY_STATUS_TONES[journey.status] ?? 'default'}>
              {statusLabel(JOURNEY_STATUS_LABELS, journey.status)}
            </Tag>
          </View>

          <View className="row">
            <Text className="row-label">旅程号</Text>
            <Text>{journey.journeyNo}</Text>
          </View>
          <View className="row">
            <Text className="row-label">阶段</Text>
            <Text>
              {JOURNEY_PHASE_LABELS[journey.phase] ?? journey.phase}
              {journey.dayOffsetLabel ? ` · ${journey.dayOffsetLabel}` : ''}
            </Text>
          </View>
          <View className="row">
            <Text className="row-label">移植日</Text>
            <Text>{formatDate(journey.transplantDate)}</Text>
          </View>
          <View className="row">
            <Text className="row-label">服药方案</Text>
            <Text>{DOSING_SCHEME_LABELS[journey.dosingScheme]}</Text>
          </View>
          <View className="row">
            <Text className="row-label">清肠药</Text>
            <Tag type={BOWEL_PREP_STATUS_TONES[journey.bowelPrepStatus] ?? 'default'}>
              {statusLabel(BOWEL_PREP_STATUS_LABELS, journey.bowelPrepStatus)}
            </Tag>
          </View>
          {journey.bowelPrep?.selfDrugName ? (
            <Text className="muted">
              自购：{journey.bowelPrep.selfDrugName}
              {journey.bowelPrep.selfNote ? `（${journey.bowelPrep.selfNote}）` : ''}
            </Text>
          ) : null}

          <View className="journey-card-actions">
            {journey.status !== 'cancelled' && journey.status !== 'completed' ? (
              <NutButton
                size="small"
                fill="outline"
                onClick={() => {
                  setEditingId(editingId === journey.id ? '' : journey.id)
                  setDate(journey.transplantDate ? journey.transplantDate.slice(0, 10) : suggestedDate())
                }}
              >
                {journey.status === 'pending_schedule' ? '代设移植日' : '调整移植日'}
              </NutButton>
            ) : null}
            {journey.bowelPrepStatus === 'platform_ordered' ? (
              <NutButton
                size="small"
                type="primary"
                loading={submitting === journey.id}
                onClick={() => void markReady(journey)}
              >
                代确认已备好
              </NutButton>
            ) : null}
          </View>

          {editingId === journey.id ? (
            <View className="journey-schedule-box">
              <Picker
                mode="date"
                value={date}
                start={tomorrow()}
                onChange={(event) => setDate(String(event.detail.value))}
              >
                <View className="journey-date-field">
                  <Text className="row-label">移植日</Text>
                  <Text className="journey-date-value">{date} ›</Text>
                </View>
              </Picker>
              <NutButton
                block
                type="primary"
                size="small"
                loading={submitting === journey.id}
                onClick={() => void submitSchedule(journey)}
              >
                保存并生成推送计划
              </NutButton>
            </View>
          ) : null}

          {journey.pauseReason ? (
            <Text className="muted">暂停原因：{journey.pauseReason}</Text>
          ) : null}
        </View>
      ))}

      {items.length > 0 ? (
        <View className="journey-foot-link" onClick={() => go('/pages/notifications/index')}>
          <Icon name="bell" size={14} />
          <Text>查看预警通知</Text>
        </View>
      ) : null}
    </View>
  )
}
