import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'
import { formatCents } from '@mall/shared'
import { api, ensureLogin } from '../../lib/api'

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
      void Taro.showToast({ title: '请输入采购数量', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      await api('/procurement-orders', {
        method: 'POST',
        data: { items: [{ productId, quantity: value }] },
      })
      void Taro.showToast({ title: '采购单已提交', icon: 'success' })
      setQuantity((current) => ({ ...current, [productId]: '1' }))
      await load()
    } catch (cause) {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '提交失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      <View className="section">
        <Text className="section-title">可采商品</Text>
        {products.length === 0 ? <Text className="muted">暂无商品</Text> : null}
        {products.map((product) => (
          <View key={product.id} className="card">
            <View className="row">
              <Text>{product.name}</Text>
              <Text className="tag">{formatCents(product.supplyPriceCents)} 元</Text>
            </View>
            <Text className="muted">{product.skuCode}</Text>
            <Input
              className="input"
              type="number"
              value={quantity[product.id] ?? '1'}
              placeholder="采购数量"
              onInput={(event) =>
                setQuantity((current) => ({ ...current, [product.id]: event.detail.value }))
              }
            />
            <Button className="btn" loading={loading} onClick={() => submit(product.id)}>
              预付款采购
            </Button>
          </View>
        ))}
      </View>

      <View className="section">
        <Text className="section-title">我的采购单</Text>
        {orders.map((order) => (
          <View key={order.id} className="card">
            <View className="row">
              <Text>{order.orderNo}</Text>
              <Text className="tag">{order.status}</Text>
            </View>
            <View className="row">
              <Text className="row-label">金额</Text>
              <Text>{formatCents(order.totalAmountCents)} 元</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
