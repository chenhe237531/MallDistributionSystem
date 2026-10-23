import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { formatCents } from '@mall/shared'
import { api, ensureLogin } from '../../lib/api'
import {
  Button as NutButton,
  Cell,
  CellGroup,
  Empty,
  Input as NutInput,
  Price,
  Tag,
  Toast,
} from '@nutui/nutui-react-taro'

type Product = {
  id: string
  name: string
  skuCode: string
  supplyPriceCents: number
}
type Order = {
  id: string
  orderNo: string
  status: string
  totalAmountCents: number
}

const toast = (title: string, icon?: 'success' | 'fail') =>
  Toast.show('b-toast', { title, icon })

export default function Procurement() {
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [quantity, setQuantity] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const [productList, orderList] = await Promise.all([
      api<Product[]>('/products'),
      api<Order[]>('/procurement-orders'),
    ])
    setProducts(productList.filter((product) => product.id))
    setOrders(orderList)
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
    })
  })

  const submit = async (productId: string) => {
    const value = Number(quantity[productId] ?? '1')
    if (!Number.isInteger(value) || value <= 0) {
      toast('请输入采购数量')
      return
    }
    setLoading(true)
    try {
      await api('/procurement-orders', {
        method: 'POST',
        data: { items: [{ productId, quantity: value }] },
      })
      toast('采购单已提交', 'success')
      setQuantity((current) => ({ ...current, [productId]: '1' }))
      await load()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '提交失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      <View className="section">
        <Text className="section-title">可采商品</Text>
        {products.length === 0 ? <Empty description="暂无商品" /> : null}
        {products.map((product) => (
          <View key={product.id} className="card">
            <View className="row">
              <Text className="proc-name">{product.name}</Text>
              <Price price={formatCents(product.supplyPriceCents)} size="small" />
            </View>
            <Text className="muted">{product.skuCode}</Text>
            <View className="proc-actions">
              <View className="proc-quantity">
                <NutInput
                  type="number"
                  value={quantity[product.id] ?? '1'}
                  placeholder="采购数量"
                  onBlur={(value) =>
                    setQuantity((current) => ({ ...current, [product.id]: value || '1' }))
                  }
                />
              </View>
              <NutButton
                className="proc-submit"
                type="primary"
                size="small"
                loading={loading}
                onClick={() => submit(product.id)}
              >
                预付款采购
              </NutButton>
            </View>
          </View>
        ))}
      </View>

      <View className="section">
        <Text className="section-title">我的采购单</Text>
        {orders.length === 0 ? <Empty description="暂无采购单" /> : null}
        {orders.length > 0 ? (
          <CellGroup>
            {orders.map((order) => (
              <Cell
                key={order.id}
                title={order.orderNo}
                description={
                  <View className="row">
                    <Text className="muted">金额</Text>
                    <Text className="biz-amount">{formatCents(order.totalAmountCents)} 元</Text>
                  </View>
                }
                extra={<Tag type="primary">{order.status}</Tag>}
              />
            ))}
          </CellGroup>
        ) : null}
      </View>

      <Toast id="b-toast" />
    </View>
  )
}
