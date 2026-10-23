import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { ROLE_LABELS, Role, formatCents } from '@mall/shared'
import { api, clearToken, ensureLogin, go } from '../../lib/api'
import {
  Button as NutButton,
  Dialog,
  Grid,
  GridItem,
} from '@nutui/nutui-react-taro'

type Me = {
  name: string
  roles: string[]
  primaryRole: string
  organizationName?: string
}

type Prepaid = { account: { availableCents: number; frozenCents: number } }

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
}

const ENTRIES = [
  { label: '采购商城', url: '/pages/procurement/index' },
  { label: '预付款', url: '/pages/prepaid/index' },
  { label: '我的客户', url: '/pages/customers/index' },
  { label: '报告与解读', url: '/pages/reports/index' },
  { label: '我的生意', url: '/pages/business/index' },
  { label: '素材与培训', url: '/pages/materials/index' },
  { label: '课程与考试', url: '/pages/training/index' },
  { label: '消息中心', url: '/pages/notifications/index' },
  { label: '客户认领', url: '/pages/claims/index' },
]

/** 预付款余额偏低阈值：100 元 */
const PREPAID_LOW_THRESHOLD_CENTS = 10000

/** 待签合同状态：草稿 / 待签署 / 待续签 */
const CONTRACT_PENDING_STATUSES = ['draft', 'pending_sign', 'pending_renewal']

/** 待学课程状态：未完成或待考试（passed 之外均算） */
const TRAINING_TODO_STATUSES = ['not_started', 'learning', 'pending_exam', 'expired']

export default function Index() {
  const [me, setMe] = useState<Me | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
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

    const [reportRes, trainingRes, contractRes, prepaidRes] = await Promise.allSettled([
      api<ReportTaskGroup[]>('/notifications/report-tasks'),
      api<TrainingRecord[]>('/training/me'),
      api<Contract[]>('/contracts/mine'),
      api<Prepaid>('/prepaid/me'),
    ])

    const nextTodos: TodoItem[] = [
      {
        key: 'reports',
        label: '待转发报告',
        unit: '份',
        url: '/pages/notifications/index',
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
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
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
        <Text className="section-title">今日待办</Text>
        <View className="card index-todo-card">
          {todos.map((item, index) => (
            <View
              key={item.key}
              className={index === 0 ? 'index-todo-row index-todo-row-first' : 'index-todo-row'}
              onClick={() => go(item.url)}
            >
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
          <Grid columns={3} gap={6}>
            {ENTRIES.map((entry) => (
              <GridItem key={entry.url} onClick={() => go(entry.url)}>
                <View className="index-entry">
                  <Text className="index-entry-name">{entry.label}</Text>
                  <Text className="index-entry-hint">进入</Text>
                </View>
              </GridItem>
            ))}
          </Grid>
        </View>
      </View>

      <NutButton className="index-logout" block type="danger" fill="outline" onClick={confirmLogout}>
        退出登录
      </NutButton>

      <Dialog id="b-logout" />
    </View>
  )
}
