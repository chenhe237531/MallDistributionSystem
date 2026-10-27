import { useMemo, useState } from 'react'
import Taro, { useDidShow, getCurrentInstance } from '@tarojs/taro'
import { Input, Text, View } from '@tarojs/components'
import {
  PROCUREMENT_STATUS_LABELS,
  formatCents,
  statusLabel,
} from '@mall/shared'
import { api, ensureLogin, go } from '../../lib/api'
import { cartCount, readCart, writeCart, type CartMap } from '../../lib/cart'
import { AppTabbar } from '../../components/AppTabbar'
import { Icon } from '../../components/Icon'
import { GoodsCard, type GoodsSummary } from '../../components/goods/GoodsCard'
import { Button } from '../../components/Button'
import { StatusTag } from '../../components/goods/StatusTag'
import { ProcurementProgress } from '../../components/process/ProcurementProgress'
import { MALL_CATEGORIES, goodsTags } from '../../config/home'
import { Empty, Toast } from '@nutui/nutui-react-taro'
import { useTheme } from '../../lib/theme'

type Product = GoodsSummary & {
  retailPriceCents?: number | null
}

type OrderItem = { id: string; productName: string; quantity: number }

type Order = {
  id: string
  orderNo: string
  status: string
  totalAmountCents: number
  createdAt?: string
  remark?: string | null
  items?: OrderItem[]
}

const toast = (title: string, icon?: 'success' | 'fail') =>
  Toast.show('b-toast', { title, icon })

const matchKeywords = (name: string, keywords: string[]): boolean =>
  keywords.some((keyword) => name.toUpperCase().includes(keyword.toUpperCase()))

export default function Procurement() {
  const { themeClass } = useTheme()
  const router = getCurrentInstance().router
  const rawCat = typeof router?.params?.cat === 'string' ? router.params.cat : 'all'
  const initialCat = MALL_CATEGORIES.some((item) => item.key === rawCat) ? rawCat : 'all'
  const initialStatus = typeof router?.params?.status === 'string' ? router.params.status : ''
  const initialView = router?.params?.view === 'orders' || initialStatus ? 'orders' : 'mall'

  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState(initialCat)
  const [activeSub, setActiveSub] = useState('')
  const [view, setView] = useState<'mall' | 'orders'>(initialView)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [cart, setCart] = useState<CartMap>(readCart)
  const [unread, setUnread] = useState(0)
  const [expandedOrder, setExpandedOrder] = useState('')

  const load = async () => {
    const [productList, orderList, notificationRes] = await Promise.all([
      api<Product[]>('/products'),
      api<Order[]>('/procurement-orders'),
      api<{ unread: number }>('/notifications/me'),
    ])
    setProducts(productList.filter((product) => product.id))
    setOrders(orderList)
    setUnread(notificationRes.unread)
    setLoaded(true)
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    setCart(readCart())
    void load().catch((cause) => {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
    })
  })

  const updateCart = (next: CartMap) => {
    setCart(next)
    writeCart(next)
  }

  const addToCart = (productId: string) => {
    updateCart({ ...cart, [productId]: (cart[productId] ?? 0) + 1 })
    toast('已加入采购车', 'success')
  }

  const category = MALL_CATEGORIES.find((item) => item.key === activeCat) ?? MALL_CATEGORIES[0]
  const sub = category.subs.find((item) => item.key === activeSub)

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // 方案 §3.3：一级分类以落库 category 为准，不再按商品名关键词猜测
      if (category.key !== 'all' && product.category !== category.key) {
        return false
      }
      if (sub && !matchKeywords(product.name, sub.keywords)) {
        return false
      }
      if (search.trim()) {
        const keyword = search.trim().toUpperCase()
        if (
          !product.name.toUpperCase().includes(keyword) &&
          !product.skuCode.toUpperCase().includes(keyword)
        ) {
          return false
        }
      }
      return true
    })
  }, [products, category, sub, search])

  const count = cartCount(cart)
  const cartTotalCents = useMemo(
    () =>
      Object.entries(cart).reduce((sum, [productId, qty]) => {
        const product = products.find((item) => item.id === productId)
        return product ? sum + qty * product.supplyPriceCents : sum
      }, 0),
    [cart, products],
  )

  const filteredOrders = useMemo(() => {
    if (!statusFilter) {
      return orders
    }
    const allowed = statusFilter.split(',')
    return orders.filter((order) => allowed.includes(order.status))
  }, [orders, statusFilter])

  const pickCategory = (key: string) => {
    setActiveCat(key)
    setActiveSub('')
  }

  const goCart = () => {
    void Taro.redirectTo({ url: '/pages/cart/index' })
  }

  const openDetail = (productId: string) => {
    go(`/pages/product-detail/index?id=${productId}`)
  }

  const formatDate = (iso?: string) => (iso ? iso.slice(5, 16).replace('T', ' ') : '')

  return (
    <View className={`page page-tabbar-proc ${themeClass}`} style={{ padding: 0 }}>
      <View className="proc-head">
        <View
          className="b-hero-bell"
          style={{ top: 8, right: 8 }}
          onClick={() => go('/pages/notifications/index')}
        >
          <Icon name="bell" size={20} />
          {unread > 0 ? <View className="b-hero-bell-badge">{unread > 99 ? '99+' : unread}</View> : null}
        </View>
        <Text className="proc-head-title">采购商城</Text>
        <View className="proc-head-search">
          <Icon name="search" size={14} />
          <Input
            className="proc-head-input"
            value={search}
            placeholder="搜索商品名称 / SKU"
            onInput={(event) => setSearch(event.detail.value)}
          />
        </View>
      </View>

      <View className="proc-body">
        <View className="proc-side">
          {MALL_CATEGORIES.map((item) => (
            <View
              key={item.key}
              className={`proc-side-item ${item.key === category.key ? 'proc-side-item-active' : ''}`}
              onClick={() => pickCategory(item.key)}
            >
              {item.label}
            </View>
          ))}
        </View>

        <View className="proc-main">
          <View className="proc-view-tabs">
            <View
              className={`proc-view-tab ${view === 'mall' ? 'proc-view-tab-active' : ''}`}
              onClick={() => setView('mall')}
            >
              可采商品
            </View>
            <View
              className={`proc-view-tab ${view === 'orders' ? 'proc-view-tab-active' : ''}`}
              onClick={() => {
                setView('orders')
                setStatusFilter('')
              }}
            >
              我的采购单
            </View>
          </View>

          {view === 'mall' ? (
            <View>
              <View className="proc-price-entry" onClick={() => go('/pages/pricing/index')}>
                <View className="proc-price-entry-main">
                  <Text className="proc-price-entry-title">商品定价</Text>
                  <Text className="proc-price-entry-desc">C 端默认按采购价 2 倍，可自定义</Text>
                </View>
                <Text className="proc-price-entry-action">去设置 ›</Text>
              </View>

              {category.subs.length > 0 ? (
                <View className="proc-sub-pills">
                  <View
                    className={`proc-sub-pill ${!sub ? 'proc-sub-pill-active' : ''}`}
                    onClick={() => setActiveSub('')}
                  >
                    全部
                  </View>
                  {category.subs.map((item) => (
                    <View
                      key={item.key}
                      className={`proc-sub-pill ${sub?.key === item.key ? 'proc-sub-pill-active' : ''}`}
                      onClick={() => setActiveSub(item.key)}
                    >
                      {item.label}
                    </View>
                  ))}
                </View>
              ) : null}

              {!loaded ? null : filteredProducts.length === 0 ? (
                <Empty description="该分类暂无可采商品" />
              ) : (
                filteredProducts.map((product) => (
                  <GoodsCard
                    key={product.id}
                    product={product}
                    tags={goodsTags(product.category)}
                    onOpen={() => openDetail(product.id)}
                    onAdd={() => addToCart(product.id)}
                  />
                ))
              )}
            </View>
          ) : (
            <View>
              {statusFilter ? (
                <View className="proc-sub-pills">
                  <View className="proc-sub-pill proc-sub-pill-active" onClick={() => setStatusFilter('')}>
                    已筛选：{statusFilter.split(',').map((status) => statusLabel(PROCUREMENT_STATUS_LABELS, status)).join('、')} ✕
                  </View>
                </View>
              ) : null}
              {filteredOrders.length === 0 ? (
                <Empty description="暂无采购单" />
              ) : (
                filteredOrders.map((order) => {
                  const expanded = expandedOrder === order.id
                  const firstItem = order.items?.[0]
                  return (
                    <View
                      key={order.id}
                      className="proc-order-row proc-order-card"
                      onClick={() => setExpandedOrder(expanded ? '' : order.id)}
                    >
                      <View className="proc-order-head">
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text className="proc-name2">{order.orderNo}</Text>
                          <Text className="proc-sku">
                            {formatDate(order.createdAt)}
                            {firstItem
                              ? ` · ${firstItem.productName}${(order.items?.length ?? 1) > 1 ? ` 等 ${order.items?.length} 种` : ` ×${firstItem.quantity}`}`
                              : ''}
                          </Text>
                        </View>
                        <StatusTag status={order.status} />
                      </View>
                      <ProcurementProgress status={order.status} compact={!expanded} />
                      <View className="proc-order-foot">
                        <Text className="proc-sku">合计</Text>
                        <Text className="proc-order-total">¥{formatCents(order.totalAmountCents)}</Text>
                        <Text className="proc-order-toggle">{expanded ? '收起 ⌃' : '展开进度 ⌄'}</Text>
                      </View>
                      {expanded ? (
                        <View className="proc-order-items">
                          {(order.items ?? []).map((item) => (
                            <Text key={item.id} className="proc-order-item">
                              {item.productName} ×{item.quantity}
                            </Text>
                          ))}
                          {order.remark ? <Text className="proc-sku">备注：{order.remark}</Text> : null}
                        </View>
                      ) : null}
                    </View>
                  )
                })
              )}
            </View>
          )}
        </View>
      </View>

      {view === 'mall' && count > 0 ? (
        <View className="proc-settle">
          <View className="proc-settle-info">
            <Text className="proc-settle-count">已选 {count} 件</Text>
            <Text className="proc-settle-total">¥{formatCents(cartTotalCents)}</Text>
          </View>
          <Button variant="primary" size="lg" onClick={goCart}>
            去结算
          </Button>
        </View>
      ) : null}

      <Toast id="b-toast" />
      <AppTabbar active="mall" />
    </View>
  )
}
