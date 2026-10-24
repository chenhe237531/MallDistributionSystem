import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { Button as NutButton, Empty, Price, Tag } from '@nutui/nutui-react-taro'
import {
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_TONES,
  designTokens,
  formatCents,
  statusLabel,
} from '@mall/shared'
import { api, ensureLogin, go } from '../../lib/api'

type Order = {
  id: string
  orderNo: string
  status: string
  totalAmountCents: number
  createdAt: string
  items: Array<{ id: string; productName: string; quantity: number }>
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ensureLogin()) {
      return
    }
    void api<Order[]>('/sales-orders')
      .then(setOrders)
      .catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
  }, [])

  return (
    <View className="page">
      <View className="section">
        <Text className="section-title">我的订单</Text>
        {error ? <Text className="error">{error}</Text> : null}
        {orders.length === 0 ? <Empty description="暂无订单" /> : null}
        {orders.map((order) => (
          <View key={order.id} className="card">
            <View className="row">
              <Text className="card-title">{order.orderNo}</Text>
              <Tag type={SALES_ORDER_STATUS_TONES[order.status] ?? 'default'}>
                {statusLabel(SALES_ORDER_STATUS_LABELS, order.status)}
              </Tag>
            </View>
            {order.items.map((item) => (
              <Text key={item.id} className="muted">
                {item.productName} × {item.quantity}
              </Text>
            ))}
            <View className="price-row">
              <Price price={formatCents(order.totalAmountCents)} symbol="¥" color={designTokens.colorPrimary} />
              <NutButton
                size="small"
                fill="outline"
                onClick={() => go(`/pages/order-detail/index?orderNo=${order.orderNo}`)}
              >
                查看详情
              </NutButton>
            </View>
            <Text className="muted">{new Date(order.createdAt).toLocaleString('zh-CN')}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
