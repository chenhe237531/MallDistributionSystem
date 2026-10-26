import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { ROLE_LABELS, Role, formatCents } from '@mall/shared'
import { api, clearToken, ensureLogin, go } from '../../lib/api'
import { PageToast, toast } from '../../components/feedback'
import { AppTabbar } from '../../components/AppTabbar'
import { Icon, type IconName } from '../../components/Icon'
import { PROFILE_ORDER_BUCKETS } from '../../config/home'
import { Button as NutButton, Dialog } from '@nutui/nutui-react-taro'

type Me = {
  name: string
  roles: string[]
  primaryRole: string
  organizationName?: string
}

type Prepaid = { account: { availableCents: number; frozenCents: number } }

type Order = {
  id: string
  status: string
  totalAmountCents: number
}

type AppEntry = {
  label: string
  icon: IconName
  tone: 'primary' | 'success' | 'warning' | 'danger'
  url: string
}

/** 我的应用 2×4 宫格（§6.4-5）；新增「业务流程」入口（方案 §3.5-5d） */
const APP_ENTRIES: AppEntry[] = [
  { label: '我的客户', icon: 'users', tone: 'primary', url: '/pages/customers/index' },
  { label: '报告与解读', icon: 'report', tone: 'success', url: '/pages/reports/index' },
  { label: '我的生意', icon: 'chart', tone: 'warning', url: '/pages/business/index' },
  { label: '课程与考试', icon: 'book', tone: 'primary', url: '/pages/training/index' },
  { label: '客户认领', icon: 'userPlus', tone: 'success', url: '/pages/claims/index' },
  { label: '业务流程', icon: 'packageCheck', tone: 'warning', url: '/pages/guide/index' },
  { label: '消息中心', icon: 'message', tone: 'warning', url: '/pages/notifications/index' },
  { label: '关于百英诺', icon: 'info', tone: 'danger', url: '/pages/index/index' },
]

/** 预付款余额偏低阈值：100 元 */
const PREPAID_LOW_THRESHOLD_CENTS = 10000

export default function Profile() {
  const [me, setMe] = useState<Me | null>(null)
  const [prepaid, setPrepaid] = useState<Prepaid | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [unread, setUnread] = useState(0)

  const load = async () => {
    const [profile, notificationRes, orderList] = await Promise.all([
      api<Me>('/auth/me'),
      api<{ unread: number }>('/notifications/me'),
      api<Order[]>('/sales-orders'),
    ])
    setMe(profile)
    setUnread(notificationRes.unread)
    setOrders(orderList)
    if (profile.roles.includes('merchant')) {
      setPrepaid(await api<Prepaid>('/prepaid/me'))
    }
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => {
      toast(cause instanceof Error ? cause.message : '加载失败', 'fail')
    })
  })

  const roleLabel = me ? ROLE_LABELS[me.primaryRole as Role] ?? me.primaryRole : '—'

  /** 累计采购：非取消订单金额合计（前端聚合，不新增统计口径） */
  const totalPurchaseCents = orders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + order.totalAmountCents, 0)

  const availableCents = prepaid?.account.availableCents ?? null
  const frozenCents = prepaid?.account.frozenCents ?? null
  const balanceLow = availableCents !== null && availableCents < PREPAID_LOW_THRESHOLD_CENTS

  const openOrders = (statuses?: string[]) => {
    const query = statuses ? `?status=${statuses.join(',')}` : ''
    go(`/pages/procurement/index${query}`)
  }

  const openAbout = () => {
    // 品牌介绍在首页锚点区；携带锚点标记由首页自动滚动
    void Taro.redirectTo({ url: '/pages/index/index?anchor=brand' })
  }

  const openApp = (entry: AppEntry) => {
    if (entry.label === '关于百英诺') {
      openAbout()
    } else {
      go(entry.url)
    }
  }

  const confirmLogout = () => {
    Dialog.open('b-profile-logout', {
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      cancelText: '取消',
      onConfirm: () => {
        Dialog.close('b-profile-logout')
        clearToken()
        void Taro.redirectTo({ url: '/pages/login/index' })
      },
      onCancel: () => Dialog.close('b-profile-logout'),
    })
  }

  return (
    <View className="page page-tabbar">
      <PageToast />

      <View className="profile-user-card">
        <View
          className="profile-bell"
          onClick={() => go('/pages/notifications/index')}
        >
          <Icon name="bell" size={20} />
          {unread > 0 ? <View className="profile-bell-badge">{unread > 99 ? '99+' : unread}</View> : null}
        </View>
        <View className="profile-avatar">{(me?.name ?? '商').slice(0, 1)}</View>
        <View className="profile-user-main">
          <View className="profile-name-row">
            <Text className="profile-name">{me?.name ?? '商户'}</Text>
            <Text className="profile-role-tag">{roleLabel}</Text>
          </View>
          <Text className="profile-org">{me?.organizationName ?? '—'}</Text>
        </View>
      </View>

      <View className="card profile-stats">
        <View className="metric-item">
          <Text className="metric-value">
            {availableCents === null ? '—' : `${formatCents(availableCents)}`}
          </Text>
          <Text className="metric-label">可用预付款（元）</Text>
        </View>
        <View className="metric-divider" />
        <View className="metric-item">
          <Text className="metric-value">
            {frozenCents === null ? '—' : `${formatCents(frozenCents)}`}
          </Text>
          <Text className="metric-label">冻结预付款（元）</Text>
        </View>
        <View className="metric-divider" />
        <View className="metric-item">
          <Text className="metric-value">{formatCents(totalPurchaseCents)}</Text>
          <Text className="metric-label">累计采购（元）</Text>
        </View>
      </View>

      <View className="prepaid-banner">
        <View className="prepaid-banner-main">
          <Text className="prepaid-banner-title">
            {availableCents === null ? '预付款账户' : balanceLow ? '预付款余额偏低' : '预付款账户健康'}
          </Text>
          <Text className="prepaid-banner-sub">
            {availableCents === null
              ? '—'
              : balanceLow
                ? '预付款余额不足时采购将受限'
                : `可用 ${formatCents(availableCents)} 元 · 采购无忧`}
          </Text>
        </View>
        {balanceLow ? (
          <View className="prepaid-banner-btn" onClick={() => go('/pages/prepaid/index')}>
            立即充值
          </View>
        ) : null}
      </View>

      <View className="section">
        <Text className="section-title">我的采购单</Text>
        <View className="card">
          <View className="profile-orders-grid">
            {PROFILE_ORDER_BUCKETS.map((bucket) => {
              const count = orders.filter((order) => bucket.statuses.includes(order.status)).length
              return (
                <View
                  key={bucket.key}
                  className="profile-order-entry"
                  onClick={() => openOrders(bucket.statuses)}
                >
                  {count > 0 ? <View className="profile-order-badge">{count}</View> : null}
                  <View className={`profile-app-icon tone-${bucket.key === 'after_sale' ? 'danger' : 'primary'}`}>
                    <Icon name={bucket.icon} size={20} />
                  </View>
                  <Text className="profile-order-name">{bucket.label}</Text>
                </View>
              )
            })}
          </View>
          <View className="profile-all-orders" onClick={() => openOrders()}>
            全部采购单
          </View>
        </View>
      </View>

      <View className="section">
        <Text className="section-title">经营工具</Text>
        <View className="card profile-tool" onClick={() => go('/pages/pricing/index')}>
          <View className="profile-tool-icon tone-primary">
            <Icon name="card" size={20} />
          </View>
          <View className="profile-tool-main">
            <Text className="profile-tool-name">商品定价</Text>
            <Text className="profile-tool-desc">设置 C 端售价，默认按采购价 2 倍生成</Text>
          </View>
          <Text className="profile-tool-arrow">›</Text>
        </View>
      </View>

      <View className="section">
        <Text className="section-title">我的应用</Text>
        <View className="card profile-app-grid">
          {APP_ENTRIES.map((entry) => (
            <View
              key={entry.label}
              className="profile-app-item"
              onClick={() => openApp(entry)}
            >
              <View className={`profile-app-icon tone-${entry.tone}`}>
                <Icon name={entry.icon} size={20} />
              </View>
              <Text className="profile-app-name">{entry.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <NutButton className="profile-logout" block type="danger" fill="outline" onClick={confirmLogout}>
        退出登录
      </NutButton>

      <Dialog id="b-profile-logout" />
      <AppTabbar active="profile" />
    </View>
  )
}
