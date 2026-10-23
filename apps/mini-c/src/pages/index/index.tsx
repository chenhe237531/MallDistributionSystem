import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { Button as NutButton, Empty, Price, Tag } from '@nutui/nutui-react-taro'
import { formatCents } from '@mall/shared'
import { api, clearToken, getToken, go, routeParams } from '../../lib/api'

type StorefrontItem = {
  listingId: string
  merchantId: string
  merchantName: string
  productId: string
  productName: string
  skuCode: string
  retailPriceCents: number
  available: number
}

const ENTRIES = [
  { label: '扫码激活', url: '/pages/activate/index' },
  { label: '我的订单', url: '/pages/orders/index' },
  { label: '我的报告', url: '/pages/reports/index' },
  { label: '消息中心', url: '/pages/notifications/index' },
  { label: '隐私与授权', url: '/pages/profile/index' },
]

export default function Index() {
  const channelCode = routeParams().channel ?? ''
  const [items, setItems] = useState<StorefrontItem[]>([])
  const [loggedIn, setLoggedIn] = useState(Boolean(getToken()))
  const [error, setError] = useState('')

  useEffect(() => {
    setLoggedIn(Boolean(getToken()))
    void api<StorefrontItem[]>(
      `/sales-orders/storefront${channelCode ? `?channelCode=${channelCode}` : ''}`,
    )
      .then(setItems)
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : '加载失败')
      })
  }, [channelCode])

  return (
    <View className="page">
      <View className="hero">
        <Text className="hero-role">C 端 · 检测商城</Text>
        <Text className="hero-title">居家检测，报告解读</Text>
        <Text className="hero-status">
          {loggedIn ? '已登录 · 可下单与查看报告' : '未登录 · 点击下方入口登录'}
        </Text>
      </View>

      {error ? <Text className="error">{error}</Text> : null}

      <View className="section">
        <Text className="section-title">在售检测盒</Text>
        {items.length === 0 ? <Empty description="暂无在售商品" /> : null}
        {items.map((item) => (
          <View key={item.listingId} className="card">
            <View className="row">
              <Text className="card-title">{item.productName}</Text>
              <Tag plain type="primary">
                {item.merchantName}
              </Tag>
            </View>
            <Text className="muted">
              {item.skuCode} · 库存 {item.available} 盒
            </Text>
            <View className="price-row">
              <Price price={formatCents(item.retailPriceCents)} symbol="¥" color="#dc2626" />
              <NutButton
                type="primary"
                size="small"
                onClick={() => {
                  if (!getToken()) {
                    go('/pages/login/index')
                    return
                  }
                  go(
                    `/pages/order/index?listingId=${item.listingId}&name=${encodeURIComponent(item.productName)}&price=${item.retailPriceCents}&merchant=${encodeURIComponent(item.merchantName)}${channelCode ? `&channel=${channelCode}` : ''}`,
                  )
                }}
              >
                立即购买
              </NutButton>
            </View>
          </View>
        ))}
      </View>

      <View className="section">
        <Text className="section-title">我的服务</Text>
        <View className="entry-grid">
          {ENTRIES.map((entry) => (
            <View
              key={entry.url}
              className="entry-item"
              onClick={() => {
                if (!getToken()) {
                  go('/pages/login/index')
                  return
                }
                go(entry.url)
              }}
            >
              <Text>{entry.label}</Text>
              <Text className="entry-tag">进入 →</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="action-gap" />
      {loggedIn ? (
        <NutButton
          block
          fill="outline"
          onClick={() => {
            clearToken()
            setLoggedIn(false)
            void Taro.reLaunch({ url: '/pages/index/index' })
          }}
        >
          退出登录
        </NutButton>
      ) : (
        <NutButton block type="primary" onClick={() => go('/pages/login/index')}>
          登录 / 注册
        </NutButton>
      )}

      <View className="notice">
        <Text>本报告仅用于健康风险提示，不作为临床诊断依据。</Text>
      </View>
    </View>
  )
}
