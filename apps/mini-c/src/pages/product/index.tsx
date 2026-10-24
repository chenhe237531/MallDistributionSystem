import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { Button as NutButton, Empty, Tag } from '@nutui/nutui-react-taro'
import { formatCents } from '@mall/shared'
import { api, ensureLogin, go, routeParams } from '../../lib/api'
import { PageToast, toast } from '../../components/feedback'

type RelatedItem = {
  productId: string
  name: string
  skuCode: string
  listingId: string | null
  retailPriceCents: number | null
}

type StorefrontItem = {
  listingId: string
  merchantId: string
  merchantName: string
  productId: string
  productName: string
  skuCode: string
  retailPriceCents: number
  available: number
  guideVideoUrl?: string | null
  intro?: string | null
  related?: RelatedItem[]
}

/**
 * FR-C1 第 2 步：商品详情页。
 * 主价格用主色大号字；主行动按钮「立即购买」固定在底部安全区上方、宽度通栏。
 */
export default function Product() {
  const params = routeParams()
  const listingId = params.listingId ?? ''
  const channelCode = params.channel ?? ''

  const [item, setItem] = useState<StorefrontItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    void api<StorefrontItem[]>(
      `/sales-orders/storefront${channelCode ? `?channelCode=${channelCode}` : ''}`,
    )
      .then((items) => {
        const found = items.find((entry) => entry.listingId === listingId) ?? null
        if (!found) {
          setError('商品已下架或不存在')
        }
        setItem(found)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [listingId, channelCode])

  const soldOut = Boolean(item && item.available <= 0)

  const buy = () => {
    if (!item) {
      return
    }
    if (!ensureLogin()) {
      return
    }
    if (soldOut) {
      toast('商品暂时无库存', 'fail')
      return
    }
    go(
      `/pages/order/index?listingId=${item.listingId}&name=${encodeURIComponent(item.productName)}&price=${item.retailPriceCents}&merchant=${encodeURIComponent(item.merchantName)}${channelCode ? `&channel=${channelCode}` : ''}`,
    )
  }

  if (!loading && !item) {
    return (
      <View className="page">
        <PageToast />
        <Empty description={error || '商品不存在'} />
        <View className="field-gap" />
        <NutButton block fill="outline" onClick={() => go('/pages/index/index')}>
          返回商城
        </NutButton>
      </View>
    )
  }

  return (
    <View className="page">
      <PageToast />
      {item ? (
        <>
          <View className="card">
            <View className="detail-media">
              <Text className="detail-media-title">{item.productName.slice(0, 6)}</Text>
              <Text className="detail-media-sub">居家自采样 · 实验室检测</Text>
            </View>
            <View className="field-gap" />
            <View className="row">
              <Text className="card-title">{item.productName}</Text>
              <Tag plain type="primary">
                {item.merchantName}
              </Tag>
            </View>
            <View className="price-main">
              <Text className="price-main-symbol">¥</Text>
              <Text>{formatCents(item.retailPriceCents)}</Text>
            </View>
            {item.guideVideoUrl ? <Text className="video-flag">含采样指导视频</Text> : null}
            {soldOut ? <Text className="stock-out">当前库存不足，暂时无法购买</Text> : null}
            <View className="meta-grid">
              <View className="meta-item">
                <Text className="meta-item-label">商品编码</Text>
                <Text className="meta-item-value">{item.skuCode}</Text>
              </View>
              <View className="meta-item">
                <Text className="meta-item-label">库存</Text>
                <Text className="meta-item-value">{item.available} 盒</Text>
              </View>
              <View className="meta-item">
                <Text className="meta-item-label">配送</Text>
                <Text className="meta-item-value">快递寄送</Text>
              </View>
            </View>
          </View>

          <View className="card">
            <Text className="section-title">商品介绍</Text>
            <Text className="intro-text">
              {item.intro || '居家自采样检测盒：收到后扫码激活，按指导完成采样并寄回，实验室检测完成后可在「我的报告」查看报告与 AI 解读。'}
            </Text>
          </View>

          {item.related && item.related.length > 0 ? (
            <View className="card">
              <Text className="section-title">搭配推荐</Text>
              {item.related.map((rel) =>
                rel.listingId && rel.retailPriceCents != null ? (
                  <View
                    key={rel.productId}
                    className="related-line"
                    onClick={() =>
                      go(
                        `/pages/product/index?listingId=${rel.listingId}${channelCode ? `&channel=${channelCode}` : ''}`,
                      )
                    }
                  >
                    <Text className="related-item">{rel.name}</Text>
                    <Text> ¥{formatCents(rel.retailPriceCents)}</Text>
                  </View>
                ) : (
                  <View key={rel.productId} className="related-line">
                    <Text>{rel.name}</Text>
                  </View>
                ),
              )}
            </View>
          ) : null}

          <View className="notice">
            <Text>本报告仅用于健康风险提示，不作为临床诊断依据。</Text>
          </View>

          <View className="bottom-bar-placeholder" />
          <View className="bottom-bar">
            <View className="bottom-bar-amount">
              <Text className="bottom-bar-amount-label">价格</Text>
              <Text className="bottom-bar-amount-value">¥{formatCents(item.retailPriceCents)}</Text>
            </View>
            <View className="bottom-bar-main">
              <NutButton block type="primary" disabled={soldOut} onClick={buy}>
                立即购买
              </NutButton>
            </View>
          </View>
        </>
      ) : (
        <View className="card">
          <Text className="muted">加载中…</Text>
        </View>
      )}
    </View>
  )
}
