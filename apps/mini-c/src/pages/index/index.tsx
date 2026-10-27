import { useEffect, useMemo, useState } from 'react'
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import { Empty } from '@nutui/nutui-react-taro'
import { formatCents } from '@mall/shared'
import { AppTabbar } from '../../components/AppTabbar'
import { GoodsImage } from '../../components/GoodsImage'
import { Icon } from '../../components/Icon'
import { ServicePanel } from '../../components/ServicePanel'
import { api, getToken, go, routeParams } from '../../lib/api'
import {
  BRAND,
  HOME_BANNERS,
  HOME_ENTRIES,
  REPORT_DISCLAIMER,
  type HomeEntry,
} from '../../lib/content'
import {
  fetchStorefront,
  productCategoryOptions,
  type StorefrontProduct,
} from '../../lib/storefront'
import logo from '../../assets/logo.png'

type Me = { phone: string; name: string }

function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone
}

/**
 * C 端商城首页（方案 v1.2 §5.1）：品牌头部 → 使用说明 → 服务入口 → 分类筛选 → 带图商品列表。
 * 商品与商家端同源，价格取商家上架价（默认采购价 × 2）。
 */
export default function Index() {
  const channelCode = routeParams().channel ?? ''
  const [items, setItems] = useState<StorefrontProduct[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [loggedIn, setLoggedIn] = useState(Boolean(getToken()))
  const [phone, setPhone] = useState('')
  const [serviceVisible, setServiceVisible] = useState(false)
  const [bannerIndex, setBannerIndex] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoggedIn(Boolean(getToken()))
    void fetchStorefront(channelCode)
      .then(setItems)
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : '加载失败')
      })
  }, [channelCode])

  useEffect(() => {
    if (!getToken()) {
      return
    }
    void api<Me>('/customers/me')
      .then((me) => setPhone(me.phone))
      .catch(() => setPhone(''))
  }, [loggedIn])

  const categories = useMemo(() => productCategoryOptions(items), [items])
  const filtered = useMemo(
    () =>
      activeCategory === 'all'
        ? items
        : items.filter((item) => item.category === activeCategory),
    [items, activeCategory],
  )

  const openEntry = (entry: HomeEntry) => {
    if (entry.action === 'service') {
      setServiceVisible(true)
      return
    }
    if (!entry.url) {
      return
    }
    if (entry.auth && !getToken()) {
      go('/pages/login/index')
      return
    }
    go(entry.url)
  }

  const openProduct = (listingId: string) => {
    if (!getToken()) {
      go('/pages/login/index')
      return
    }
    go(`/pages/product/index?listingId=${listingId}${channelCode ? `&channel=${channelCode}` : ''}`)
  }

  const openBanner = () => {
    const banner = HOME_BANNERS[bannerIndex] ?? HOME_BANNERS[0]
    if (banner.url.includes('/progress') && !getToken()) {
      go('/pages/login/index')
      return
    }
    go(banner.url)
  }

  return (
    <View className="page page-with-tabbar store-page">
      <View className="store-hero">
        <View className="store-hero-top">
          <Image className="store-hero-logo" src={logo} mode="aspectFit" />
          <View className="store-hero-brand">
            <Text className="store-hero-name">{BRAND.name}</Text>
            <Text className="store-hero-en">
              {BRAND.nameEn} · {BRAND.slogan}
            </Text>
          </View>
          {loggedIn ? (
            <View className="store-hero-user">
              <Text>{phone ? maskPhone(phone) : '已登录'}</Text>
            </View>
          ) : (
            <View className="store-hero-login" onClick={() => go('/pages/login/index')}>
              <Text>登录</Text>
            </View>
          )}
        </View>
        <Text className="store-hero-title">肠道菌群检测与菌群移植</Text>
        <Text className="store-hero-sub">居家自采样 · 实验室检测 · 专业报告解读</Text>
        <View className="store-hero-tags">
          <Text className="store-hero-tag">同济共建菌库</Text>
          <Text className="store-hero-tag">3 万+ 微生物全景</Text>
          <Text className="store-hero-tag">AI 报告解读</Text>
        </View>
      </View>

      <View className="banner-wrap">
        <Swiper
          className="banner-swiper"
          indicatorDots
          autoplay
          indicatorColor="rgba(22, 119, 255, 0.25)"
          indicatorActiveColor="#1677ff"
          onChange={(event) => setBannerIndex(event.detail.current)}
        >
          {HOME_BANNERS.map((banner) => (
            <SwiperItem key={banner.title}>
              <View className="banner-slide">
                <Text className="banner-title">{banner.title}</Text>
                <Text className="banner-sub">{banner.subtitle}</Text>
              </View>
            </SwiperItem>
          ))}
        </Swiper>
        {/* Swiper 内部会拦截点击事件，CTA 作为外层覆盖按钮保证可点（§4.1） */}
        <View className="banner-cta-overlay" role="button" onClick={openBanner}>
          <Text>{HOME_BANNERS[bannerIndex]?.cta ?? '查看详情'} ›</Text>
        </View>
      </View>

      <View className="service-grid">
        {HOME_ENTRIES.map((entry) => (
          <View
            key={entry.key}
            className="service-item"
            role="button"
            onClick={() => openEntry(entry)}
          >
            <View className="service-icon">
              <Icon name={entry.icon} size={22} />
            </View>
            <Text className="service-name">{entry.label}</Text>
          </View>
        ))}
      </View>

      {error ? <Text className="error">{error}</Text> : null}

      <View className="store-section-head">
        <Text className="store-section-title">在售商品</Text>
        <Text className="store-section-count">{filtered.length} 款</Text>
      </View>

      {categories.length > 1 ? (
        <View className="store-cats">
          {categories.map((category) => (
            <View
              key={category.key}
              className={`store-cat ${activeCategory === category.key ? 'store-cat-active' : ''}`}
              onClick={() => setActiveCategory(category.key)}
            >
              <Text>{category.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {filtered.length === 0 ? <Empty description="暂无在售商品" /> : null}

      <View className="store-list">
        {filtered.map((item) => (
          <View
            key={item.listingId}
            className="store-card"
            onClick={() => openProduct(item.listingId)}
          >
            <View className="store-card-media">
              <GoodsImage
                src={item.images[0]}
                name={item.productName}
                className="store-card-img"
              />
              {item.available <= 0 ? <Text className="store-soldout">暂时缺货</Text> : null}
            </View>
            <View className="store-card-body">
              <Text className="store-card-name">{item.productName}</Text>
              <View className="store-card-tags">
                {item.categoryLabel ? (
                  <Text className="store-tag store-tag-primary">{item.categoryLabel}</Text>
                ) : null}
                {item.guideVideoUrl ? <Text className="store-tag">含采样视频</Text> : null}
                {item.sampleType ? (
                  <Text className="store-tag store-tag-muted">{item.sampleType}</Text>
                ) : null}
              </View>
              <Text className="store-card-desc">{item.intro}</Text>
              <View className="store-card-foot">
                <View className="store-price">
                  <Text className="store-price-symbol">¥</Text>
                  <Text className="store-price-value">
                    {formatCents(item.retailPriceCents)}
                  </Text>
                </View>
                <View className="store-buy">立即购买</View>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View className="store-assurance">
        <View className="store-assurance-item">
          <Icon name="checkCircle" size={16} />
          <Text>正品保障</Text>
        </View>
        <View className="store-assurance-item">
          <Icon name="box" size={16} />
          <Text>冷链配送</Text>
        </View>
        <View className="store-assurance-item">
          <Icon name="report" size={16} />
          <Text>报告解读</Text>
        </View>
      </View>

      <View className="notice">
        <Text>{REPORT_DISCLAIMER}</Text>
      </View>

      <ServicePanel visible={serviceVisible} onClose={() => setServiceVisible(false)} />
      <AppTabbar active="home" />
    </View>
  )
}
