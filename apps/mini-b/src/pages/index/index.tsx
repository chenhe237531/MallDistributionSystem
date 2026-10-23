import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import { ROLE_LABELS, Role, formatCents } from '@mall/shared'
import { api, clearToken, ensureLogin, go } from '../../lib/api'

type Me = {
  name: string
  roles: string[]
  primaryRole: string
  organizationName?: string
}

type Prepaid = { account: { availableCents: number; frozenCents: number } }

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

export default function Index() {
  const [me, setMe] = useState<Me | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [reminders, setReminders] = useState(0)
  const [unread, setUnread] = useState(0)
  const [pendingForwards, setPendingForwards] = useState(0)

  const load = async () => {
    const profile = await api<Me>('/auth/me')
    setMe(profile)
    if (profile.roles.includes('merchant')) {
      const prepaid = await api<Prepaid>('/prepaid/me')
      setBalance(prepaid.account.availableCents)
      const tasks = await api<Array<{ pendingCount: number }>>('/notifications/report-tasks')
      setPendingForwards(tasks.reduce((sum, group) => sum + group.pendingCount, 0))
    }
    const reminderList = await api<unknown[]>('/reminders/me')
    setReminders(reminderList.length)
    const notifications = await api<{ unread: number }>('/notifications/me')
    setUnread(notifications.unread)
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

  return (
    <View className="page">
      <View className="hero">
        <Text className="hero-role">{roleLabel}端</Text>
        <Text className="hero-title">你好，{me?.name ?? '商户'}</Text>
        <Text className="hero-balance">
          {balance === null ? '预付款 —' : `可用预付款 ${formatCents(balance)} 元`}
        </Text>
        <Text className="hero-status">
          {me?.organizationName ?? '—'} · {reminders} 条待办 · {unread} 条未读
          {pendingForwards > 0 ? ` · ${pendingForwards} 份报告待转发` : ''}
        </Text>
      </View>

      <View className="section">
        <Text className="section-title">快捷入口</Text>
        <View className="entry-grid">
          {ENTRIES.map((entry) => (
            <View key={entry.url} className="entry-item" onClick={() => go(entry.url)}>
              <Text>{entry.label}</Text>
              <Text className="entry-tag">进入</Text>
            </View>
          ))}
        </View>
      </View>

      <Button
        className="btn-secondary"
        onClick={() => {
          clearToken()
          void Taro.redirectTo({ url: '/pages/login/index' })
        }}
      >
        退出登录
      </Button>
    </View>
  )
}
