import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Image, ScrollView, Swiper, SwiperItem, Text, Video, View } from '@tarojs/components'
import { formatCents, productCategoryLabel } from '@mall/shared'
import { api, ensureLogin, go, resolveAsset } from '../../lib/api'
import { cartCount, readCart, writeCart } from '../../lib/cart'
import { GoodsThumb } from '../../components/goods/GoodsThumb'
import { SpecList } from '../../components/goods/SpecList'
import { Button } from '../../components/Button'
import { goodsTags } from '../../config/home'
import { Empty, Toast } from '@nutui/nutui-react-taro'
import { useTheme } from '../../lib/theme'

type RelatedProduct = {
  id: string
  name: string
  skuCode: string
  images?: string[]
  category?: string | null
  supplyPriceCents?: number | null
  retailPriceCents?: number | null
}

type BoundCourse = { id: string; name: string; category?: string | null }

type ProductDetail = {
  id: string
  skuCode: string
  name: string
  testItems: string[]
  sampleType: string
  samplingMethod: string
  storageCondition: string
  shelfLifeDays?: number | null
  supplyPriceCents: number
  retailPriceCents?: number | null
  suggestedRetailPriceCents?: number | null
  images: string[]
  category?: string | null
  intro?: string | null
  guideVideoUrl?: string | null
  availableStock?: number
  relatedProducts?: RelatedProduct[]
  boundCourses?: BoundCourse[]
}

/** 分类合规声明（方案 §3.2-8；文案取自归档转化方案 §2.13 合规口径） */
function complianceText(category?: string | null): string {
  if (category === 'fmt' || category === 'adjunct') {
    return '本产品属严肃医疗产品，须在执业医疗机构及医师指导下使用，严禁自行服用；页面信息不构成诊疗建议。'
  }
  if (category === 'consumer_health') {
    return '本产品为普通食品（特殊膳食），不能替代药物，不用于疾病治疗；页面信息仅供健康参考。'
  }
  if (category === 'gut_test') {
    return '检测报告仅用于健康风险提示，不作为临床诊断依据；采样与寄回请按说明书操作。'
  }
  return '本页面内容仅供健康信息参考，不构成诊疗建议。'
}

const toast = (title: string, icon?: 'success' | 'fail') => Toast.show('b-toast', { title, icon })

export default function ProductDetail() {
  const { themeClass } = useTheme()
  const router = useRouter()
  const id = router.params.id ?? ''
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ensureLogin()) {
      return
    }
    if (!id) {
      setLoading(false)
      return
    }
    api<ProductDetail>(`/products/${id}`)
      .then(setDetail)
      .catch((cause) => {
        toast(cause instanceof Error ? cause.message : '商品加载失败', 'fail')
      })
      .finally(() => setLoading(false))
    // 仅在页面参数变化时重新拉取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const addToCart = (redirect = false) => {
    if (!detail) {
      return
    }
    const cart = readCart()
    const next = { ...cart, [detail.id]: (cart[detail.id] ?? 0) + 1 }
    writeCart(next)
    if (redirect) {
      void Taro.redirectTo({ url: '/pages/cart/index' })
      return
    }
    toast(`已加入采购车（共 ${cartCount(next)} 件）`, 'success')
  }

  if (!loading && !detail) {
    return (
      <View className={`page ${themeClass}`}>
        <Empty description="商品不存在或已下架" />
      </View>
    )
  }

  if (!detail) {
    return <View className={`page ${themeClass}`} />
  }

  const images = (detail.images ?? []).map(resolveAsset).filter(Boolean)
  const tags = goodsTags(detail.category)
  const paragraphs = (detail.intro ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const retail = detail.retailPriceCents ?? 0

  return (
    <View className={`page page-detail ${themeClass}`}>
      {images.length > 0 ? (
        <Swiper
          className="detail-swiper"
          circular
          indicatorDots={images.length > 1}
          indicatorColor="rgba(31,35,41,0.2)"
          indicatorActiveColor="var(--mall-primary)"
        >
          {images.map((src) => (
            <SwiperItem key={src}>
              <Image className="detail-hero-img" src={src} mode="aspectFill" />
            </SwiperItem>
          ))}
        </Swiper>
      ) : (
        <View className="detail-hero-empty">
          <GoodsThumb name={detail.name} size="lg" />
          <Text className="detail-hero-empty-text">商品图待补充</Text>
        </View>
      )}

      <View className="detail-card">
        <View className="detail-price-row">
          <Text className="detail-price">
            <Text className="detail-price-symbol">¥</Text>
            {formatCents(detail.supplyPriceCents)}
          </Text>
          <Text className="detail-channel-tag">渠道专享价</Text>
          {retail > detail.supplyPriceCents ? (
            <Text className="detail-retail">建议零售 ¥{formatCents(retail)}</Text>
          ) : null}
        </View>
        <Text className="detail-name">{detail.name}</Text>
        <View className="detail-tags">
          <Text className="detail-tag detail-tag-cat">{productCategoryLabel(detail.category)}</Text>
          {tags.map((tag) => (
            <Text key={tag} className="detail-tag">
              {tag}
            </Text>
          ))}
          <Text className="detail-sku">SKU {detail.skuCode}</Text>
        </View>
      </View>

      <View className="detail-card">
        <Text className="detail-section-title">规格参数</Text>
        <SpecList
          items={[
            { label: '检测项目 / 主要成分', value: detail.testItems?.join('、') },
            { label: '样本类型', value: detail.sampleType },
            { label: '采样 / 使用方式', value: detail.samplingMethod },
            { label: '储存条件', value: detail.storageCondition },
            {
              label: '保质期',
              value: detail.shelfLifeDays ? `${detail.shelfLifeDays} 天` : undefined,
            },
            {
              label: '可采库存',
              value:
                typeof detail.availableStock === 'number' ? `${detail.availableStock} 件` : undefined,
            },
          ]}
        />
      </View>

      <View className="detail-card">
        <Text className="detail-section-title">商品介绍</Text>
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph) => (
            <Text key={paragraph.slice(0, 24)} className="detail-paragraph">
              {paragraph}
            </Text>
          ))
        ) : (
          <Text className="detail-paragraph detail-muted">商家暂未补充商品介绍。</Text>
        )}
        {images.slice(1).map((src) => (
          <Image key={src} className="detail-inline-img" src={src} mode="widthFix" />
        ))}
      </View>

      {detail.guideVideoUrl ? (
        <View className="detail-card">
          <Text className="detail-section-title">采样 / 使用指导</Text>
          <View className="detail-video-wrap">
            <Video
              className="detail-video"
              src={resolveAsset(detail.guideVideoUrl)}
              controls
              showCenterPlayBtn
            />
          </View>
          <Text className="detail-video-hint">建议下单后先观看视频，按规范完成采样或使用。</Text>
        </View>
      ) : null}

      {detail.relatedProducts && detail.relatedProducts.length > 0 ? (
        <View className="detail-card">
          <Text className="detail-section-title">搭配推荐</Text>
          <ScrollView className="detail-related-scroll" scrollX>
            {detail.relatedProducts.map((item) => (
              <View
                key={item.id}
                className="detail-related-card"
                onClick={() => go(`/pages/product-detail/index?id=${item.id}`)}
              >
                <GoodsThumb src={item.images?.[0]} name={item.name} size="lg" />
                <Text className="detail-related-name">{item.name}</Text>
                {typeof item.supplyPriceCents === 'number' ? (
                  <Text className="detail-related-price">¥{formatCents(item.supplyPriceCents)}</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {detail.boundCourses && detail.boundCourses.length > 0 ? (
        <View className="detail-card">
          <Text className="detail-section-title">关联培训</Text>
          {detail.boundCourses.map((course) => (
            <View
              key={course.id}
              className="detail-course-row"
              onClick={() => go('/pages/training/index')}
            >
              <Text className="detail-course-name">{course.name}</Text>
              <Text className="detail-course-arrow">›</Text>
            </View>
          ))}
          <Text className="detail-video-hint">销售该商品前建议完成对应课程学习。</Text>
        </View>
      ) : null}

      <Text className="detail-compliance">{complianceText(detail.category)}</Text>

      <View className="detail-actionbar">
        {/* 描金次核心 + 金色渐变主 CTA（黑金规范 §5.1，避免双金抢戏） */}
        <Button variant="outline" size="lg" className="detail-action-item" onClick={() => addToCart(false)}>
          加入采购车
        </Button>
        <Button variant="primary" size="lg" className="detail-action-item" onClick={() => addToCart(true)}>
          立即采购
        </Button>
      </View>

      <Toast id="b-toast" />
    </View>
  )
}
