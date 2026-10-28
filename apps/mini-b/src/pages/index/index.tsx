import { useRef, useState } from 'react'
import Taro, { useDidShow, getCurrentInstance } from '@tarojs/taro'
import { Swiper, SwiperItem, ScrollView, Text, View } from '@tarojs/components'
import { ROLE_LABELS, Role, formatCents } from '@mall/shared'
import { api, ensureLogin, go } from '../../lib/api'
import { PageToast, toast } from '../../components/feedback'
import { AppTabbar } from '../../components/AppTabbar'
import { Icon } from '../../components/Icon'
import { GoodsThumb } from '../../components/goods/GoodsThumb'
import { BrandIntro, ContactCard } from '../../components/home/BrandIntro'
import {
  BANNERS,
  NOTICE_TEXT,
  PRIMARY_HOME_ENTRIES,
  SECONDARY_HOME_ENTRIES,
  SERVICE_HOTLINE,
  type HomeEntry,
} from '../../config/home'
import { useTheme } from '../../lib/theme'

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

type HotProduct = {
  id: string
  name: string
  images?: string[]
  category?: string | null
  supplyPriceCents: number
  retailPriceCents?: number | null
}

type TodoItem = {
  key: string
  label: string
  /** null 表示加载失败，展示 — */
  count: number | null
  unit: string
  hint?: string
  url: string
  icon: 'upload' | 'book' | 'edit' | 'card'
  tone: EntryTone
}

type EntryTone = 'primary' | 'success' | 'warning' | 'danger'

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
  const { themeClass } = useTheme()
  const [me, setMe] = useState<Me | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [todayOrders, setTodayOrders] = useState<number | null>(null)
  const [todayIncomeCents, setTodayIncomeCents] = useState<number | null>(null)
  const [reminders, setReminders] = useState(0)
  const [unread, setUnread] = useState(0)
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [hotProducts, setHotProducts] = useState<HotProduct[]>([])
  const [showAllApps, setShowAllApps] = useState(false)
  // Taro View 实例类型跨端不一致，此处仅读取 H5 的 offsetTop 做锚点滚动
  const brandRef = useRef<any>(null)

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

    // 热销推荐（方案 §3.4）：首页直接露出带图商品卡，进入详情仅 1 次点击
    const productList = await api<HotProduct[]>('/products').catch(() => [])
    setHotProducts(productList.filter((product) => product.id).slice(0, 6))

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
        icon: 'upload',
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
        icon: 'book',
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
        icon: 'edit',
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
        icon: 'card',
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
    // 「我的」页「关于百英诺」入口：跳回首页并滚动到品牌介绍区
    if (getCurrentInstance().router?.params?.anchor === 'brand') {
      setTimeout(scrollToBrand, 300)
    }
  })

  const roleLabel = me
    ? ROLE_LABELS[me.primaryRole as Role] ?? me.primaryRole
    : ''

  const scrollToBrand = () => {
    try {
      const node = brandRef.current as { offsetTop?: number } | null
      const scrollTop = node?.offsetTop ?? 0
      void Taro.pageScrollTo({ scrollTop: Math.max(scrollTop - 8, 0), duration: 300 })
    } catch {
      // H5 shadow DOM 下取不到 offsetTop 时静默降级
    }
  }

  const openEntry = (entry: HomeEntry) => {
    if (entry.url) {
      go(entry.url)
    } else {
      scrollToBrand()
    }
  }

  const openMallWithCategory = (category: string) => {
    go(`/pages/procurement/index?cat=${category}`)
  }

  const copyWechat = (wechatId: string) => {
    void Taro.setClipboardData({
      data: wechatId,
      success: () => toast('微信号已复制', 'success'),
    })
  }

  return (
    <View className={`page page-tabbar prototype-shell ${themeClass}`}>
      <PageToast />

      <View className="hero b-hero prototype-surface prototype-decor">
        <View
          className="b-hero-bell"
          onClick={() => go('/pages/notifications/index')}
        >
          <Icon name="bell" size={20} />
          {unread > 0 ? <View className="b-hero-bell-badge">{unread > 99 ? '99+' : unread}</View> : null}
        </View>
        <Text className="b-hero-kicker">百英诺 · 商家中心</Text>
        <Text className="b-hero-brand">你好，{me?.name ?? '商户'}</Text>
        <View className="b-hero-meta">
          <Text className="b-hero-role">{roleLabel}</Text>
          <Text className="b-hero-org">{me?.organizationName ?? '暂未绑定机构'}</Text>
        </View>
        <View className="b-hero-balance">
          <Text className="b-hero-balance-label">可用预付款</Text>
          <Text className="b-hero-balance-value">
            {balance === null ? '—' : `${formatCents(balance)} 元`}
          </Text>
        </View>
        <View className="b-search" onClick={() => go('/pages/procurement/index')}>
          <Icon name="search" size={15} />
          <Text className="b-search-text">搜索商品 / 功能</Text>
        </View>
      </View>

      <View className="section home-operations">
        <View className="home-section-head">
          <Text className="section-title">今日经营</Text>
          <Text className="home-section-note">数据实时更新</Text>
        </View>
        <View className="card metric-row home-metric-card prototype-surface">
          <View className="metric-item metric-item-primary">
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
            <Text className="metric-label">待处理</Text>
          </View>
        </View>
      </View>

      <View className="section home-apps-section">
        <View className="home-section-head">
          <Text className="section-title">常用功能</Text>
          <View className="home-apps-toggle" onClick={() => setShowAllApps((visible) => !visible)}>
            <Text>{showAllApps ? '收起' : '全部应用'}</Text>
            <Icon name="arrowRight" size={14} className={showAllApps ? 'home-apps-toggle-icon-open' : ''} />
          </View>
        </View>
        <View className="card home-apps-card prototype-surface">
          <View className="b-grid b-grid-primary">
            {PRIMARY_HOME_ENTRIES.map((entry) => (
              <View key={entry.label} className="b-grid-item" onClick={() => openEntry(entry)}>
                <View className={`b-grid-icon tone-${entry.tone}`}>
                  <Icon name={entry.icon} size={22} />
                </View>
                <Text className="b-grid-name">{entry.label}</Text>
              </View>
            ))}
          </View>
          {showAllApps ? (
            <View className="b-grid b-grid-secondary">
              {SECONDARY_HOME_ENTRIES.map((entry) => (
                <View key={entry.label} className="b-grid-item" onClick={() => openEntry(entry)}>
                  <View className={`b-grid-icon tone-${entry.tone}`}>
                    <Icon name={entry.icon} size={22} />
                  </View>
                  <Text className="b-grid-name">{entry.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <Swiper
        className="b-banner"
        autoplay
        circular
        interval={3600}
        indicatorDots
        indicatorColor="rgba(255,255,255,0.4)"
        indicatorActiveColor="#ffffff"
      >
        {BANNERS.map((banner) => (
          <SwiperItem key={banner.title}>
            <View className="b-banner-slide" onClick={() => go(banner.url)}>
              <Text className="b-banner-title">{banner.title}</Text>
              <Text className="b-banner-sub">{banner.subtitle}</Text>
              <View className="b-banner-action">
                <Text>{banner.action}</Text>
                <Icon name="arrowRight" size={13} />
              </View>
              <Text className="b-banner-hotline">服务热线 {SERVICE_HOTLINE}</Text>
            </View>
          </SwiperItem>
        ))}
      </Swiper>

      <View className="b-notice">
        <Icon name="horn" size={14} />
        <View className="b-notice-text-wrap">
          <Text className="b-notice-text">{NOTICE_TEXT}</Text>
        </View>
      </View>

      {hotProducts.length > 0 ? (
        <View className="section">
          <View className="home-goods-head">
            <Text className="section-title">热销推荐</Text>
            <Text className="home-goods-more" onClick={() => go('/pages/procurement/index')}>
              查看全部 ›
            </Text>
          </View>
          <ScrollView className="home-goods-scroll" scrollX>
            {hotProducts.map((product) => (
              <View
                key={product.id}
                className="home-goods-card"
                onClick={() => go(`/pages/product-detail/index?id=${product.id}`)}
              >
                <GoodsThumb src={product.images?.[0]} name={product.name} size="lg" />
                <Text className="home-goods-name">{product.name}</Text>
                <View className="home-goods-price-row">
                  <Text className="home-goods-price">¥{formatCents(product.supplyPriceCents)}</Text>
                  <Text className="home-goods-tag">渠道价</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

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
                <Icon name={item.icon} size={18} />
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

      <View ref={brandRef}>
        <BrandIntro
          onOpenCategory={openMallWithCategory}
          onOpenGuide={() => go('/pages/guide/index')}
        />
      </View>

      <ContactCard onCopy={copyWechat} />

      <AppTabbar active="home" />
    </View>
  )
}
