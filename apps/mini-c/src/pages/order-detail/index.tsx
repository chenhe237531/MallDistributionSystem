import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { Button as NutButton, Empty, Tag } from '@nutui/nutui-react-taro'
import {
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_TONES,
  formatCents,
  statusLabel,
} from '@mall/shared'
import { api, go, routeParams } from '../../lib/api'
import { PageToast, toast } from '../../components/feedback'

type OrderItem = {
  id: string
  productName: string
  quantity: number
  amountCents: number
}

type Order = {
  id: string
  orderNo: string
  status: string
  totalAmountCents: number
  refundedAmountCents?: number
  contactName?: string
  contactPhone?: string
  address?: string | null
  createdAt: string
  items: OrderItem[]
}

const STATUS_LABELS = SALES_ORDER_STATUS_LABELS

/** 主步骤条节点（与订单状态机一致，退款 / 售后走分支标签） */
const MAIN_STEPS: Array<{ key: string; label: string; match: string[] }> = [
  {
    key: 'pending_payment',
    label: '待支付',
    match: ['pending_payment'],
  },
  {
    key: 'paid',
    label: '已支付',
    match: ['paid', 'pending_shipment'],
  },
  {
    key: 'fulfilling',
    label: '履约中',
    match: ['shipped', 'pending_sampling', 'testing', 'report_ready'],
  },
  {
    key: 'completed',
    label: '已完成',
    match: ['completed'],
  },
]

/** 退款 / 售后 / 取消等分支状态，以标签呈现，不挤占主步骤条 */
const BRANCH_STATUSES: Record<string, string> = {
  refunding: '退款处理中',
  refunded: '已退款',
  after_sale: '售后处理中',
  cancelled: '订单已取消',
}

function stepState(orderStatus: string, index: number): 'done' | 'current' | 'todo' {
  const reachedIndex = MAIN_STEPS.findIndex((step) => step.match.includes(orderStatus))
  if (reachedIndex < 0) {
    // 分支状态（退款 / 取消）：已走过的节点全部置灰处理
    return 'todo'
  }
  if (index < reachedIndex) {
    return 'done'
  }
  if (index === reachedIndex) {
    return 'current'
  }
  return 'todo'
}

/**
 * FR-C2：订单详情页，含状态步骤条可视化。
 */
export default function OrderDetail() {
  const params = routeParams()
  const orderNo = params.orderNo ?? ''

  const [order, setOrder] = useState<Order | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void api<Order[]>('/sales-orders')
      .then((orders) => {
        setOrder(orders.find((entry) => entry.orderNo === orderNo) ?? null)
      })
      .catch((cause) => toast(cause instanceof Error ? cause.message : '查询订单失败', 'fail'))
      .finally(() => setLoaded(true))
  }, [orderNo])

  const branchLabel = order ? BRANCH_STATUSES[order.status] : undefined

  return (
    <View className="page">
      <PageToast />
      {order ? (
        <>
          <View className="card">
            <View className="row">
              <Text className="card-title">订单进度</Text>
              <Tag type={SALES_ORDER_STATUS_TONES[order.status] ?? 'default'}>
                {statusLabel(STATUS_LABELS, order.status)}
              </Tag>
            </View>
            <View className="order-steps">
              {MAIN_STEPS.map((step, index) => {
                const state = stepState(order.status, index)
                return (
                  <View
                    key={step.key}
                    className={`order-step ${state === 'done' ? 'order-step-done' : ''} ${state === 'current' ? 'order-step-current' : ''}`}
                  >
                    <View className="order-step-dot" />
                    <Text className="order-step-label">{step.label}</Text>
                  </View>
                )
              })}
            </View>
            {branchLabel ? <Text className="order-branch-tag">{branchLabel}</Text> : null}
          </View>

          <View className="card">
            <Text className="section-title">商品明细</Text>
            {order.items.map((item) => (
              <View key={item.id} className="row">
                <Text>{item.productName}</Text>
                <Text>
                  × {item.quantity}
                  {item.amountCents ? `　¥${formatCents(item.amountCents)}` : ''}
                </Text>
              </View>
            ))}
            <View className="row">
              <Text className="card-title">订单金额</Text>
              <Text className="bottom-bar-amount-value">
                ¥{formatCents(order.totalAmountCents)}
              </Text>
            </View>
            {order.refundedAmountCents ? (
              <View className="row">
                <Text className="muted">已退款</Text>
                <Text className="error">-¥{formatCents(order.refundedAmountCents)}</Text>
              </View>
            ) : null}
          </View>

          <View className="card">
            <Text className="section-title">订单信息</Text>
            <View className="row">
              <Text className="muted">订单号</Text>
              <Text>{order.orderNo}</Text>
            </View>
            <View className="row">
              <Text className="muted">下单时间</Text>
              <Text>{new Date(order.createdAt).toLocaleString('zh-CN')}</Text>
            </View>
            {order.contactName ? (
              <View className="row">
                <Text className="muted">联系人</Text>
                <Text>
                  {order.contactName} {order.contactPhone ?? ''}
                </Text>
              </View>
            ) : null}
            {order.address ? (
              <View className="row">
                <Text className="muted">收货地址</Text>
                <Text style={{ maxWidth: '60%', textAlign: 'right' }}>{order.address}</Text>
              </View>
            ) : null}
          </View>

          {['paid', 'shipped', 'pending_sampling', 'testing', 'report_ready', 'completed'].includes(
            order.status,
          ) ? (
            <>
              <View className="field-gap" />
              <NutButton block type="primary" fill="outline" onClick={() => go('/pages/activate/index')}>
                扫码激活检测盒
              </NutButton>
            </>
          ) : null}
        </>
      ) : (
        <Empty description={loaded ? '订单不存在' : '加载中…'} />
      )}
    </View>
  )
}
