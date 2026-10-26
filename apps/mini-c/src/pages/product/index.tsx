import { useEffect, useState } from 'react'
import { ScrollView, Swiper, SwiperItem, Text, Video, View } from '@tarojs/components'
import { Button as NutButton, Empty } from '@nutui/nutui-react-taro'
import { formatCents } from '@mall/shared'
import { GoodsImage } from '../../components/GoodsImage'
import { Icon } from '../../components/Icon'
import { SpecList } from '../../components/SpecList'
import { PageToast, toast } from '../../components/feedback'
import { ensureLogin, go, resolveAsset, routeParams } from '../../lib/api'
import { fetchStorefrontDetail, type StorefrontProduct } from '../../lib/storefront'

/** 按品类下发合规声明（口径来源：归档资料整理与内容转化方案） */
function complianceText(category: string | null): string {
  switch (category) {
    case 'gut_test':
      return '本检测报告仅用于健康风险提示，不作为临床诊断依据；检测结果请结合临床症状由专业医师综合判断。'
    case 'fmt':
    case 'adjunct':
    case 'customized':
      return '菌群移植相关产品须在执业医师指导下使用，严禁自行服用；本页面信息不构成医疗建议。'
    case 'consumer_health':
      return '本产品为普通食品 / 特殊膳食食品，不能替代药物，不用于疾病治疗。'
    default:
      return '本页面信息仅用于产品说明，不构成医疗建议；如有健康问题请咨询专业医师。'
  }
}

function fallbackIntro(item: StorefrontProduct): string {
  if (item.category === 'gut_test') {
    return '居家自采样检测盒：收到后扫码激活，按指导完成采样并寄回，实验室检测完成后可在「我的报告」查看报告与 AI 解读。'
  }
  return '商品详情以企业提供的产品资料为准；如需进一步了解适用人群、使用方式与注意事项，请联系在线客服。'
}

/**
 * C 端商品详情（方案 v1.2 §5.2）：轮播图 → 价格与标签 → 规格参数 → 图文介绍 →
 * 采样视频 → 搭配推荐 → 服务保障 → 合规声明 → 底部购买栏。
 * 数据与商家端同一 Product 源，价格取商家上架价（默认采购价 × 2）。
 */
export default function Product() {
  const params = routeParams()
  const listingId = params.listingId ?? ''
  const channelCode = params.channel ?? ''

  const [item, setItem] = useState<StorefrontProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    void fetchStorefrontDetail(listingId)
      .then(setItem)
      .catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [listingId])

  const soldOut = Boolean(item && item.available <= 0)
  const heroImages = item ? (item.images.length > 0 ? item.images : [null]) : []
  const detailImages = item ? item.images.slice(1) : []
  const related = item?.related.filter((rel) => rel.listingId && rel.retailPriceCents != null) ?? []

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
    <View className="page pd-page">
      <PageToast />
      {item ? (
        <>
          <Swiper className="pd-swiper" indicatorDots circular indicatorActiveColor="#1677ff">
            {heroImages.map((image, index) => (
              <SwiperItem key={`${image ?? 'fallback'}-${index}`}>
                <GoodsImage
                  src={image}
                  name={item.productName}
                  className="pd-hero"
                  mode="aspectFill"
                />
              </SwiperItem>
            ))}
          </Swiper>

          <View className="card pd-summary">
            <View className="pd-price-row">
              <Text className="pd-price-symbol">¥</Text>
              <Text className="pd-price">{formatCents(item.retailPriceCents)}</Text>
              <Text className="pd-price-hint">含采样盒与报告解读</Text>
            </View>
            <Text className="pd-name">{item.productName}</Text>
            <View className="pd-tags">
              {item.categoryLabel ? <Text className="pd-tag">{item.categoryLabel}</Text> : null}
              {item.guideVideoUrl ? <Text className="pd-tag">含采样指导视频</Text> : null}
              <Text className="pd-sku">SKU {item.skuCode}</Text>
            </View>
            {soldOut ? <Text className="stock-out">当前库存不足，暂时无法购买</Text> : null}
          </View>

          <View className="card">
            <Text className="section-title">规格参数</Text>
            <SpecList
              items={[
                { label: '检测项目', value: item.testItems?.join(' / ') },
                { label: '样本类型', value: item.sampleType },
                { label: '采样方式', value: item.samplingMethod },
                { label: '储存条件', value: item.storageCondition },
                { label: '保质期', value: item.shelfLifeDays ? `${item.shelfLifeDays} 天` : null },
                { label: '库存', value: `${item.available} 盒` },
              ]}
            />
          </View>

          <View className="card">
            <Text className="section-title">商品介绍</Text>
            <Text className="intro-text">{item.intro || fallbackIntro(item)}</Text>
            {detailImages.map((image, index) => (
              <GoodsImage
                key={`${image}-${index}`}
                src={image}
                name={item.productName}
                className="pd-detail-img"
                mode="widthFix"
              />
            ))}
          </View>

          {item.guideVideoUrl ? (
            <View className="card">
              <Text className="section-title">采样指导视频</Text>
              <View className="pd-video-wrap">
                <Video
                  className="pd-video"
                  src={resolveAsset(item.guideVideoUrl)}
                  controls
                  showCenterPlayBtn
                />
              </View>
              <Text className="pd-video-hint">建议在采样前完整观看，按步骤操作可提高检测准确率。</Text>
            </View>
          ) : null}

          {related.length > 0 ? (
            <View className="card">
              <Text className="section-title">搭配推荐</Text>
              <ScrollView className="pd-related-scroll" scrollX enableFlex>
                {related.map((rel) => (
                  <View
                    key={rel.productId}
                    className="pd-related-card"
                    onClick={() =>
                      go(
                        `/pages/product/index?listingId=${rel.listingId}${channelCode ? `&channel=${channelCode}` : ''}`,
                      )
                    }
                  >
                    <GoodsImage
                      src={rel.images?.[0]}
                      name={rel.name}
                      className="pd-related-img"
                    />
                    <Text className="pd-related-name">{rel.name}</Text>
                    <Text className="pd-related-price">
                      ¥{formatCents(rel.retailPriceCents ?? 0)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View className="card pd-assurance">
            <View className="pd-assurance-item">
              <Icon name="checkCircle" size={18} />
              <Text>正品保障</Text>
            </View>
            <View className="pd-assurance-item">
              <Icon name="box" size={18} />
              <Text>冷链配送</Text>
            </View>
            <View className="pd-assurance-item">
              <Icon name="report" size={18} />
              <Text>报告解读</Text>
            </View>
          </View>

          <View className="notice">
            <Text>{complianceText(item.category)}</Text>
          </View>

          <View className="bottom-bar-placeholder" />
          <View className="bottom-bar">
            <View className="bottom-bar-amount">
              <Text className="bottom-bar-amount-label">价格</Text>
              <Text className="bottom-bar-amount-value">
                ¥{formatCents(item.retailPriceCents)}
              </Text>
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
