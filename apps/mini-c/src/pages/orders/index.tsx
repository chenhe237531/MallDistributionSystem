import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { formatCents } from '@mall/shared'
import { api, ensureLogin, go } from '../../lib/api'

type Order = {
  id: string
  orderNo: string
  status: string
  totalAmountCents: number
  createdAt: string
  items: Array<{ id: string; productName: string; quantity: number }>
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: '待支付',
  paid: '已支付',
  pending_shipment: '待发货',
  shipped: '已发货',
  pending_sampling: '待采样',
  testing: '检测中',
  report_ready: '报告已出',
  completed: '已完成',
  cancelled: '已取消',
  refunding: '退款中',
  refunded: '已退款',
  after_sale: '售后中',
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
        {orders.length === 0 ? <Text className="muted">暂无订单</Text> : null}
        {orders.map((order) => (
          <View key={order.id} className="card">
            <View className="row">
              <Text>{order.orderNo}</Text>
              <Text className="tag">{STATUS_LABELS[order.status] ?? order.status}</Text>
            </View>
            {order.items.map((item) => (
              <Text key={item.id} className="muted">
                {item.productName} × {item.quantity}
              </Text>
            ))}
            <View className="row" style={{ marginTop: '12px' }}>
              <Text style={{ color: '#dc2626', fontWeight: 600 }}>
                {formatCents(order.totalAmountCents)} 元
              </Text>
              {['paid', 'shipped', 'pending_sampling', 'testing', 'report_ready', 'completed'].includes(
                order.status,
              ) ? (
                <Text className="tag" onClick={() => go('/pages/activate/index')}>
                  扫码激活
                </Text>
              ) : null}
            </View>
            <Text className="muted">{new Date(order.createdAt).toLocaleString('zh-CN')}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
