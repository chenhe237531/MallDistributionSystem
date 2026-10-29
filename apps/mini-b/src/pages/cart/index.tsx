import { useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Input, Text, View } from '@tarojs/components'
import { formatCents } from '@mall/shared'
import { api, ensureLogin, go } from '../../lib/api'
import { cartCount, readCart, writeCart, type CartMap } from '../../lib/cart'
import { AppTabbar } from '../../components/AppTabbar'
import { Button } from '../../components/Button'
import { GoodsThumb } from '../../components/goods/GoodsThumb'
import { Empty } from '@nutui/nutui-react-taro'
import { PageToast, toast } from '../../components/feedback'
import { useTheme } from '../../lib/theme'
import { useH5DialogFocus } from '../../lib/useH5DialogFocus'

type Product = {
  id: string
  name: string
  skuCode: string
  supplyPriceCents: number
  images?: string[]
  category?: string | null
  sampleType?: string
}

export default function Cart() {
  const { themeClass } = useTheme()
  const [cart, setCart] = useState<CartMap>(readCart)
  const [products, setProducts] = useState<Product[]>([])
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [orderSubmitted, setOrderSubmitted] = useState(false)
  const [submittedSummary, setSubmittedSummary] = useState<{ count: number; totalCents: number } | null>(null)

  useH5DialogFocus({
    open: orderSubmitted,
    dialogId: 'order-submission-dialog',
    initialFocusId: 'order-submission-confirm',
    onDismiss: () => setOrderSubmitted(false),
  })

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    setCart(readCart())
    void api<Product[]>('/products')
      .then(setProducts)
      .catch((cause) => {
        toast(cause instanceof Error ? cause.message : '加载失败')
      })
  })

  const updateCart = (next: CartMap) => {
    setCart(next)
    writeCart(next)
  }

  const setQty = (productId: string, qty: number) => {
    const next = { ...cart }
    if (qty <= 0) {
      delete next[productId]
    } else {
      next[productId] = qty
    }
    updateCart(next)
  }

  const items = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, qty]) => {
          const product = products.find((item) => item.id === productId)
          return product ? { product, qty } : null
        })
        .filter((item): item is { product: Product; qty: number } => item !== null),
    [cart, products],
  )

  const totalCents = items.reduce((sum, item) => sum + item.qty * item.product.supplyPriceCents, 0)
  const count = cartCount(cart)

  const submit = async () => {
    if (items.length === 0 || submitting) {
      return
    }
    setSubmitting(true)
    try {
      await api('/procurement-orders', {
        method: 'POST',
        data: {
          items: items.map((item) => ({ productId: item.product.id, quantity: item.qty })),
          remark: remark.trim() || undefined,
        },
      })
      setSubmittedSummary({ count, totalCents })
      updateCart({})
      setRemark('')
      setOrderSubmitted(true)
      toast('采购单已提交', 'success')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className={`page page-tabbar-proc prototype-shell ${themeClass}`} style={{ padding: 0 }}>
      <View className="proc-head proc-prototype-head prototype-decor" style={{ paddingBottom: 12 }}>
        <Text className="proc-head-title">购物车</Text>
      </View>

      <View className="proc-main" style={{ minHeight: '55vh' }}>
        {items.length === 0 ? (
          <Empty description="采购车是空的，去商城逛逛吧">
            <View
              className="profile-all-orders"
              style={{ width: 160 }}
              onClick={() => void Taro.redirectTo({ url: '/pages/procurement/index' })}
            >
              去采购商城
            </View>
          </Empty>
        ) : (
          items.map(({ product, qty }) => (
            <View key={product.id} className="proc-card">
              <GoodsThumb src={product.images?.[0]} name={product.name} size="md" />
              <View className="proc-info">
                <Text className="proc-name2">{product.name}</Text>
                <Text className="proc-sku">
                  {product.skuCode}
                  {product.sampleType ? ` · ${product.sampleType}` : ''}
                </Text>
                <View className="proc-price-row">
                  <Text className="proc-price">
                    <Text className="proc-price-symbol">¥</Text>
                    {formatCents(product.supplyPriceCents)}
                  </Text>
                </View>
                <View className="proc-stepper" style={{ position: 'absolute', right: 0, bottom: 10 }}>
                  <View className="proc-step-btn" onClick={() => setQty(product.id, qty - 1)}>
                    −
                  </View>
                  <Text className="proc-step-num">{qty}</Text>
                  <View className="proc-step-btn" onClick={() => setQty(product.id, qty + 1)}>
                    +
                  </View>
                </View>
              </View>
            </View>
          ))
        )}

        {items.length > 0 ? (
          <View className="form-field">
            <Text className="form-label">备注（选填）</Text>
            <Input
              className="proc-head-input"
              style={{
                border: '1px solid var(--mall-border)',
                borderRadius: 8,
                padding: '8px 10px',
                background: 'var(--mall-bg)',
              }}
              value={remark}
              placeholder="收货说明 / 其他备注"
              onInput={(event) => setRemark(event.detail.value)}
            />
          </View>
        ) : null}
      </View>

      {count > 0 ? (
        <View className="proc-settle">
          <View className="proc-settle-info">
            <Text className="proc-settle-count">共 {count} 件</Text>
            <Text className="proc-settle-total">¥{formatCents(totalCents)}</Text>
          </View>
          <Button id="cart-submit-order" variant="primary" size="lg" loading={submitting} onClick={() => void submit()}>
            提交采购单
          </Button>
        </View>
      ) : null}

      {orderSubmitted && submittedSummary ? (
        <View className="prototype-modal-mask prototype-success-mask" onClick={() => setOrderSubmitted(false)}>
          <View
            id="order-submission-dialog"
            className="prototype-success-dialog prototype-surface prototype-decor"
            role="dialog"
            ariaRole="dialog"
            ariaRoledescription="模态对话框"
            ariaLabel="采购单提交成功"
            onClick={(event) => event.stopPropagation()}
          >
            <View className="prototype-success-mark">✓</View>
            <Text className="prototype-success-title">采购单提交成功</Text>
            <Text className="prototype-success-copy">已为您创建采购单，后续进度可在采购单中查看。</Text>
            <View className="prototype-success-summary">
              <View>
                <Text className="prototype-success-summary-label">采购数量</Text>
                <Text className="prototype-success-summary-value">{submittedSummary.count} 件</Text>
              </View>
              <View>
                <Text className="prototype-success-summary-label">采购金额</Text>
                <Text className="prototype-success-summary-value">¥{formatCents(submittedSummary.totalCents)}</Text>
              </View>
            </View>
            <Button
              id="order-submission-confirm"
              variant="primary"
              size="lg"
              block
              className="prototype-gold-action"
              onClick={() => {
                setOrderSubmitted(false)
                go('/pages/procurement/index?view=orders')
              }}
            >
              查看采购单
            </Button>
            <Button
              variant="text"
              size="md"
              className="prototype-success-secondary"
              ariaLabel="继续采购"
              onClick={() => {
                setOrderSubmitted(false)
                void Taro.redirectTo({ url: '/pages/procurement/index' })
              }}
            >
              继续采购
            </Button>
          </View>
        </View>
      ) : null}

      <PageToast />
      <AppTabbar active="cart" />
    </View>
  )
}
