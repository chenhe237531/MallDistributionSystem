import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { ROLE_LABELS, Role, formatCents } from '@mall/shared'
import { api, clearToken, ensureLogin, go } from '../../lib/api'
import { PageToast, toast } from '../../components/feedback'
import {
  Button as NutButton,
  Dialog,
} from '@nutui/nutui-react-taro'

type Me = {
  name: string
  roles: string[]
  primaryRole: string
  organizationName?: string
}

type Prepaid = { account: { availableCents: number; frozenCents: number } }

type MerchantOrder = {
  id: string
  status: string
  totalAmountCents: number
  paidAmountCents?: number | null
  paidAt?: string | null
  createdAt: string
}

type ReportTaskGroup = { pendingCount: number; overdueCount: number }

type TrainingRecord = { status: string }

type Contract = { status: string }

type TodoItem = {
  key: string
  label: string
  /** null 表示加载失败，展示 — */
  count: number | null
  unit: string
  hint?: string
  url: string
  icon: string
  tone: EntryTone
}

type EntryTone = 'primary' | 'success' | 'warning' | 'danger'

const ENTRIES: Array<{ label: string; icon: string; tone: EntryTone; url: string }> = [
  { label: '采购商城', icon: '🛒', tone: 'primary', url: '/pages/procurement/index' },
  { label: '预付款', icon: '💰', tone: 'warning', url: '/pages/prepaid/index' },
  { label: '我的客户', icon: '🤝', tone: 'success', url: '/pages/customers/index' },
  { label: '报告与解读', icon: '📋', tone: 'primary', url: '/pages/reports/index' },
  { label: '我的生意', icon: '📈', tone: 'success', url: '/pages/business/index' },
  { label: '素材与培训', icon: '🎨', tone: 'warning', url: '/pages/materials/index' },
  { label: '课程与考试', icon: '📚', tone: 'primary', url: '/pages/training/index' },
  { label: '消息中心', icon: '🔔', tone: 'danger', url: '/pages/notifications/index' },
  { label: '客户认领', icon: '🙋', tone: 'primary', url: '/pages/claims/index' },
]

/** 预付款余额偏低阈值：100 元 */
const PREPAID_LOW_THRESHOLD_CENTS = 10000

/** 待签合同状态：草稿 / 待签署 / 待续签 */
const CONTRACT_PENDING_STATUSES = ['draft', 'pending_sign', 'pending_renewal']

/** 待学课程状态：未完成或待考试（passed 之外均算） */
const TRAINING_TODO_STATUSES = ['not_started', 'learning', 'pending_exam', 'expired']

function isSameDay(iso: string, now: Date): boolean {
  const date = new Date(iso)
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

/** FR-B1：今日经营指标（现有接口聚合，不新增统计口径） */
function aggregateToday(orders: MerchantOrder[]): { orderCount: number; incomeCents: number | null } {
  const now = new Date()
  const valid = orders.filter((order) => order.status !== 'cancelled')
  const orderCount = valid.filter((order) => isSameDay(order.createdAt, now)).length
  const paidToday = valid.filter(
    (order) => typeof order.paidAmountCents === 'number' && order.paidAt && isSameDay(order.paidAt, now),
  )
  const incomeCents = paidToday.reduce((sum, order) => sum + (order.paidAmountCents ?? 0), 0)
  return { orderCount, incomeCents }
}

export default function Index() {
  const [me, setMe] = useState<Me | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [todayOrders, setTodayOrders] = useState<number | null>(null)
  const [todayIncomeCents, setTodayIncomeCents] = useState<number | null>(null)
  const [reminders, setReminders] = useState(0)
  const [unread, setUnread] = useState(0)
  const [todos, setTodos] = useState<TodoItem[]>([])

  const load = async () => {
    const profile = await api<Me>('/auth/me')
    setMe(profile)
    if (profile.roles.includes('merchant')) {
      const prepaid = await api<Prepaid>('/prepaid/me')
      setBalance(prepaid.account.availableCents)
    }
    const reminderList = await api<unknown[]>('/reminders/me')
    setReminders(reminderList.length)
    const notifications = await api<{ unread: number }>('/notifications/me')
    setUnread(notifications.unread)

    const [reportRes, trainingRes, contractRes, prepaidRes, ordersRes] = await Promise.allSettled([
      api<ReportTaskGroup[]>('/notifications/report-tasks'),
      api<TrainingRecord[]>('/training/me'),
      api<Contract[]>('/contracts/mine'),
      api<Prepaid>('/prepaid/me'),
      api<MerchantOrder[]>('/sales-orders'),
    ])

    if (ordersRes.status === 'fulfilled') {
      const { orderCount, incomeCents } = aggregateToday(ordersRes.value)
      setTodayOrders(orderCount)
      setTodayIncomeCents(incomeCents)
    } else {
      setTodayOrders(null)
      setTodayIncomeCents(null)
    }

    const nextTodos: TodoItem[] = [
      {
        key: 'reports',
        label: '待转发报告',
        unit: '份',
        url: '/pages/notifications/index',
        icon: '📤',
        tone: 'warning',
        count:
          reportRes.status === 'fulfilled'
            ? reportRes.value.reduce((sum, group) => sum + group.pendingCount + group.overdueCount, 0)
            : null,
      },
      {
        key: 'training',
        label: '待学课程',
        unit: '门',
        url: '/pages/training/index',
        icon: '📚',
        tone: 'primary',
        count:
          trainingRes.status === 'fulfilled'
            ? trainingRes.value.filter((record) => TRAINING_TODO_STATUSES.includes(record.status)).length
            : null,
      },
      {
        key: 'contracts',
        label: '待签合同',
        unit: '份',
        url: '/pages/business/index',
        icon: '✍️',
        tone: 'success',
        count:
          contractRes.status === 'fulfilled'
            ? contractRes.value.filter((contract) => CONTRACT_PENDING_STATUSES.includes(contract.status)).length
            : 0,
        hint:
          contractRes.status !== 'fulfilled' || contractRes.value.length === 0
            ? '无待签合同'
            : undefined,
      },
      {
        key: 'prepaid',
        label: '预付款提示',
        unit: '条',
        url: '/pages/prepaid/index',
        icon: '💳',
        tone: 'danger',
        count: prepaidRes.status === 'fulfilled' ? 1 : null,
        hint:
          prepaidRes.status === 'fulfilled'
            ? prepaidRes.value.account.availableCents < PREPAID_LOW_THRESHOLD_CENTS
              ? '余额偏低，建议充值'
              : '余额充足'
            : undefined,
      },
    ]
    setTodos(nextTodos)
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => {
      toast(cause instanceof Error ? cause.message : '加载失败', 'fail')
    })
  })

  const roleLabel = me
    ? ROLE_LABELS[me.primaryRole as Role] ?? me.primaryRole
    : ''

  const confirmLogout = () => {
    Dialog.open('b-logout', {
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      cancelText: '取消',
      onConfirm: () => {
        Dialog.close('b-logout')
        clearToken()
        void Taro.redirectTo({ url: '/pages/login/index' })
      },
      onCancel: () => Dialog.close('b-logout'),
    })
  }

  return (
    <View className="page">
      <PageToast />
      <View className="hero">
        <Text className="hero-role">{roleLabel}端 · 商家工作台</Text>
        <Text className="hero-title">你好，{me?.name ?? '商户'}</Text>
        <Text className="hero-balance">
          {balance === null ? '预付款 —' : `可用预付款 ${formatCents(balance)} 元`}
        </Text>
        <Text className="hero-status">
          {me?.organizationName ?? '—'} · {reminders} 条待办 · {unread} 条未读
        </Text>
      </View>

      <View className="section">
        <Text className="section-title">今日经营</Text>
        <View className="card metric-row">
          <View className="metric-item">
            <Text className="metric-value">{todayOrders === null ? '—' : `${todayOrders} 单`}</Text>
            <Text className="metric-label">今日订单</Text>
          </View>
          <View className="metric-divider" />
          <View className="metric-item">
            <Text className="metric-value">
              {todayIncomeCents === null ? '—' : `${formatCents(todayIncomeCents)} 元`}
            </Text>
            <Text className="metric-label">今日收入</Text>
          </View>
          <View className="metric-divider" />
          <View className="metric-item">
            <Text className="metric-value">{reminders + unread}</Text>
            <Text className="metric-label">待处理 · 未读</Text>
          </View>
        </View>
      </View>

      <View className="section">
        <Text className="section-title">今日待办</Text>
        <View className="card index-todo-card">
          {todos.map((item, index) => (
            <View
              key={item.key}
              className={index === 0 ? 'index-todo-row index-todo-row-first' : 'index-todo-row'}
              onClick={() => go(item.url)}
            >
              <View className={`index-todo-icon tone-${item.tone}`}>
                <Text className="index-todo-emoji">{item.icon}</Text>
              </View>
              <View className="index-todo-main">
                <Text className="index-todo-label">{item.label}</Text>
                {item.hint ? <Text className="index-todo-hint">{item.hint}</Text> : null}
              </View>
              <Text className="index-todo-value">
                {item.count === null ? '—' : `${item.count} ${item.unit}`}
              </Text>
              <Text className="index-todo-arrow">›</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="section">
        <Text className="section-title">快捷入口</Text>
        <View className="card index-grid-card">
          <View className="index-grid">
            {ENTRIES.map((entry) => (
              <View
                key={entry.url}
                className="index-entry"
                onClick={() => go(entry.url)}
              >
                <View className={`index-entry-icon tone-${entry.tone}`}>
                  <Text className="index-entry-emoji">{entry.icon}</Text>
                </View>
                <Text className="index-entry-name">{entry.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <NutButton className="index-logout" block type="danger" fill="outline" onClick={confirmLogout}>
        退出登录
      </NutButton>

      <Dialog id="b-logout" />
    </View>
  )
}
