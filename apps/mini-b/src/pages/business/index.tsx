import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Picker, Text, View } from '@tarojs/components'
import {
  COMMISSION_STATUS_LABELS,
  COMMISSION_STATUS_TONES,
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_TONES,
  STATEMENT_STATUS_LABELS,
  STATEMENT_STATUS_TONES,
  formatCents,
  statusLabel,
} from '@mall/shared'
import { api, ensureLogin } from '../../lib/api'
import {
  Cell,
  CellGroup,
  Empty,
  Tag,
} from '@nutui/nutui-react-taro'
import { useTheme } from '../../lib/theme'

type Me = { roles: string[] }
type Order = { id: string; orderNo: string; status: string; totalAmountCents: number }
type Commission = { id: string; level: number; amountCents: number; status: string }
type Statement = {
  id: string
  statementNo: string
  period: string
  totalPayableCents: number
  status: string
}
type Performance = {
  customerCount: number
  orderCount: number
  totalAmountCents: number
  avgOrderCents: number | null
}

type RangeKey = '7d' | 'month' | 'lastMonth' | 'all' | 'custom'

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: '7d', label: '近 7 天' },
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'all', label: '全部' },
  { key: 'custom', label: '自定义' },
]

const toDateText = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 计算区间起止与口径文案 */
const resolveRange = (key: RangeKey, customFrom: string, customTo: string) => {
  const today = new Date()
  if (key === '7d') {
    const start = new Date(today)
    start.setDate(start.getDate() - 6)
    const from = toDateText(start)
    const to = toDateText(today)
    return { from, to, caption: `${from} ~ ${to}` }
  }
  if (key === 'month') {
    const from = toDateText(new Date(today.getFullYear(), today.getMonth(), 1))
    const to = toDateText(today)
    return { from, to, caption: `${from} ~ ${to}` }
  }
  if (key === 'lastMonth') {
    const from = toDateText(new Date(today.getFullYear(), today.getMonth() - 1, 1))
    const to = toDateText(new Date(today.getFullYear(), today.getMonth(), 0))
    return { from, to, caption: `${from} ~ ${to}` }
  }
  if (key === 'custom') {
    return { from: customFrom, to: customTo, caption: `${customFrom} ~ ${customTo}` }
  }
  return { from: undefined, to: undefined, caption: '全部成交' }
}

export default function Business() {
  const { themeClass } = useTheme()
  const [orders, setOrders] = useState<Order[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [statements, setStatements] = useState<Statement[]>([])
  const [performance, setPerformance] = useState<Performance | null>(null)
  const [role, setRole] = useState('')
  const [rangeKey, setRangeKey] = useState<RangeKey>('all')
  const [customFrom, setCustomFrom] = useState(() => {
    const start = new Date()
    start.setDate(start.getDate() - 6)
    return toDateText(start)
  })
  const [customTo, setCustomTo] = useState(() => toDateText(new Date()))
  const [rangeLoading, setRangeLoading] = useState(false)

  const loadPerformance = async (key: RangeKey, from: string, to: string) => {
    const resolved = resolveRange(key, from, to)
    const params: string[] = []
    if (resolved.from) {
      params.push(`from=${encodeURIComponent(resolved.from)}`)
    }
    if (resolved.to) {
      params.push(`to=${encodeURIComponent(resolved.to)}`)
    }
    const query = params.length > 0 ? `?${params.join('&')}` : ''
    setPerformance(await api<Performance>(`/sales-workbench/performance${query}`))
  }

  const switchRange = (key: RangeKey) => {
    if (rangeLoading || key === rangeKey) {
      return
    }
    setRangeKey(key)
    setRangeLoading(true)
    void loadPerformance(key, customFrom, customTo)
      .catch((cause) => {
        void Taro.showToast({ title: cause instanceof Error ? cause.message : '查询失败', icon: 'none' })
      })
      .finally(() => setRangeLoading(false))
  }

  const changeCustomDate = (which: 'from' | 'to', value: string) => {
    const nextFrom = which === 'from' ? value : customFrom
    const nextTo = which === 'to' ? value : customTo
    if (which === 'from') {
      setCustomFrom(value)
    } else {
      setCustomTo(value)
    }
    if (nextFrom > nextTo) {
      void Taro.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' })
      return
    }
    if (rangeLoading) {
      return
    }
    setRangeLoading(true)
    void loadPerformance('custom', nextFrom, nextTo)
      .catch((cause) => {
        void Taro.showToast({ title: cause instanceof Error ? cause.message : '查询失败', icon: 'none' })
      })
      .finally(() => setRangeLoading(false))
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void (async () => {
      const me = await api<Me>('/auth/me')
      setRole(me.roles.includes('sales') ? 'sales' : me.roles.includes('merchant') ? 'merchant' : '')
      if (me.roles.includes('sales')) {
        await loadPerformance(rangeKey, customFrom, customTo)
      }
      if (me.roles.includes('merchant')) {
        const [orderList, commissionList, statementList] = await Promise.all([
          api<Order[]>('/sales-orders'),
          api<Commission[]>('/commissions'),
          api<Statement[]>('/statements'),
        ])
        setOrders(orderList)
        setCommissions(commissionList)
        setStatements(statementList)
      }
    })().catch((cause) => {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
    })
  })

  const rangeCaption = resolveRange(rangeKey, customFrom, customTo).caption

  return (
    <View className={`page ${themeClass}`}>
      {performance ? (
        <View className="hero">
          <Text className="hero-role">销售业绩</Text>
          <Text className="hero-title">{formatCents(performance.totalAmountCents)} 元</Text>
          <Text className="hero-status">
            {performance.customerCount} 位客户 · {performance.orderCount} 单 · 客单价{' '}
            {performance.avgOrderCents === null ? '—' : formatCents(performance.avgOrderCents)}
          </Text>
        </View>
      ) : null}

      {role === 'sales' ? (
        <View className="card biz-range-card">
          <View className="biz-range-chips">
            {RANGE_OPTIONS.map((option) => (
              <Text
                key={option.key}
                className={
                  rangeKey === option.key
                    ? 'biz-range-chip biz-range-chip-active'
                    : 'biz-range-chip'
                }
                onClick={() => switchRange(option.key)}
              >
                {option.label}
              </Text>
            ))}
          </View>
          {rangeKey === 'custom' ? (
            <View className="biz-range-pickers">
              <Picker
                mode="date"
                value={customFrom}
                onChange={(event) => changeCustomDate('from', String(event.detail.value))}
              >
                <View className="biz-range-picker">
                  <Text className="biz-range-picker-label">开始日期</Text>
                  <Text className="biz-range-picker-value">{customFrom}</Text>
                </View>
              </Picker>
              <Text className="biz-range-sep">至</Text>
              <Picker
                mode="date"
                value={customTo}
                onChange={(event) => changeCustomDate('to', String(event.detail.value))}
              >
                <View className="biz-range-picker">
                  <Text className="biz-range-picker-label">结束日期</Text>
                  <Text className="biz-range-picker-value">{customTo}</Text>
                </View>
              </Picker>
            </View>
          ) : null}
          <Text className="biz-range-caption">口径：{rangeCaption}</Text>
        </View>
      ) : null}

      {role === 'merchant' ? (
        <View className="hero">
          <Text className="hero-role">经营概览</Text>
          <Text className="hero-title">{orders.length} 笔订单</Text>
          <Text className="hero-status">
            {commissions.length} 条佣金 · {statements.length} 份对账单
          </Text>
        </View>
      ) : null}

      {role === 'merchant' ? (
        <View className="section">
          <Text className="section-title">订单</Text>
          {orders.length === 0 ? (
            <Empty description="暂无订单" />
          ) : (
            <CellGroup>
              {orders.map((order) => (
                <Cell
                  key={order.id}
                  title={order.orderNo}
                  description={
                    <Text className="biz-amount">{formatCents(order.totalAmountCents)} 元</Text>
                  }
                  extra={
                    <Tag type={SALES_ORDER_STATUS_TONES[order.status] ?? 'default'}>
                      {statusLabel(SALES_ORDER_STATUS_LABELS, order.status)}
                    </Tag>
                  }
                />
              ))}
            </CellGroup>
          )}
        </View>
      ) : null}

      {role === 'merchant' ? (
        <View className="section">
          <Text className="section-title">佣金支出</Text>
          {commissions.length === 0 ? (
            <Empty description="暂无佣金记录" />
          ) : (
            <CellGroup>
              {commissions.slice(0, 10).map((commission) => (
                <Cell
                  key={commission.id}
                  title={`${commission.level} 级佣金`}
                  description={<Text className="muted">{statusLabel(COMMISSION_STATUS_LABELS, commission.status)}</Text>}
                  extra={
                    <Text className="biz-amount">{formatCents(commission.amountCents)} 元</Text>
                  }
                />
              ))}
            </CellGroup>
          )}
        </View>
      ) : null}

      {role === 'merchant' ? (
        <View className="section">
          <Text className="section-title">月度对账单</Text>
          {statements.length === 0 ? (
            <Empty description="暂无对账单，平台生成后会在此展示" />
          ) : (
            <CellGroup>
              {statements.map((statement) => (
                <Cell
                  key={statement.id}
                  title={`${statement.period} · ${statement.statementNo}`}
                  description={
                    <Text className="biz-amount">{formatCents(statement.totalPayableCents)} 元</Text>
                  }
                  extra={
                    <Tag type={STATEMENT_STATUS_TONES[statement.status] ?? 'default'}>
                      {statusLabel(STATEMENT_STATUS_LABELS, statement.status)}
                    </Tag>
                  }
                />
              ))}
            </CellGroup>
          )}
        </View>
      ) : null}
    </View>
  )
}
