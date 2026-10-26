import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { Button as NutButton } from '@nutui/nutui-react-taro'
import { SALES_ORDER_STATUS_LABELS, formatCents, statusLabel } from '@mall/shared'
import { api, go, routeParams } from '../../lib/api'
import { PageToast, toast } from '../../components/feedback'

type Order = {
  id: string
  orderNo: string
  status: string
  totalAmountCents: number
  createdAt: string
  items: Array<{ id: string; productName: string; quantity: number }>
}

type ResultState = 'success' | 'processing' | 'failed'

/**
 * FR-C1 第 4 步：下单 / 支付结果页。
 * 三态：success（支付已确认）/ processing（待商家线下确认支付）/ failed（已取消 / 查询不到）；
 * 失败态提供「重新购买」与「查看订单」两个出口。
 */
export default function PayResult() {
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

  const state: ResultState = !order
    ? 'failed'
    : order.status === 'pending_payment'
      ? 'processing'
      : ['cancelled', 'refunded', 'refunding', 'after_sale'].includes(order.status)
        ? 'failed'
        : 'success'

  const icon = state === 'success' ? '✓' : state === 'processing' ? '⏳' : '✕'
  const iconClass =
    state === 'success'
      ? 'result-icon result-icon-success'
      : state === 'processing'
        ? 'result-icon result-icon-processing'
        : 'result-icon result-icon-failed'

  const title =
    state === 'success'
      ? '支付已确认'
      : state === 'processing'
        ? '下单成功，等待支付确认'
        : order
          ? `订单${statusLabel(SALES_ORDER_STATUS_LABELS, order.status)}`
          : '未查询到订单'

  const desc =
    state === 'success'
      ? '商家已确认收到支付，检测盒将尽快寄出；可在「我的订单」中跟踪履约进度。'
      : state === 'processing'
        ? '订单已提交成功。本商城由商家线下收款并登记确认，确认后订单进入发货流程，请耐心等待。'
        : order
          ? '如对订单状态有疑问，请联系服务商家核实。'
          : '订单不存在或已失效，可返回商城重新下单。'

  return (
    <View className="page">
      <PageToast />
      <View className="result-page">
        <View className={iconClass}>
          <Text>{icon}</Text>
        </View>
        <Text className="result-title">{title}</Text>
        <Text className="result-desc">{desc}</Text>
        {order ? (
          <>
            <Text className="result-amount">¥{formatCents(order.totalAmountCents)}</Text>
            <Text className="result-desc">订单号 {order.orderNo}</Text>
          </>
        ) : null}
      </View>

      <View className="card">
        {order ? (
          order.items.map((item) => (
            <View key={item.id} className="row">
              <Text className="muted">{item.productName}</Text>
              <Text>× {item.quantity}</Text>
            </View>
          ))
        ) : (
          <Text className="muted">{loaded ? '无订单明细' : '查询中…'}</Text>
        )}
      </View>

      <View className="field-gap" />
      <NutButton
        block
        type="primary"
        onClick={() => go(`/pages/order-detail/index?orderNo=${orderNo}`)}
      >
        查看订单
      </NutButton>
      <View className="field-gap" />
      {state === 'failed' ? (
        <>
          <NutButton block fill="outline" onClick={() => go('/pages/index/index')}>
            重新购买
          </NutButton>
          <View className="field-gap" />
        </>
      ) : null}
      <NutButton
        block
        fill="outline"
        onClick={() => void Taro.redirectTo({ url: '/pages/index/index' })}
      >
        返回商城
      </NutButton>
    </View>
  )
}
