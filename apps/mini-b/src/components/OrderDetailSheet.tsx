import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { Dialog, Tag } from '@nutui/nutui-react-taro'
import {
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_TONES,
  formatCents,
  statusLabel,
} from '@mall/shared'
import { api } from '../lib/api'
import { toast } from './feedback'
import { Icon } from './Icon'

/**
 * 商家端订单详情弹层（我的客户 / 我的生意共用）。
 *
 * 背景：C 端下单后不经过在线收银台，由商家线下收款并在后台「登记支付」。
 * 商家在手机上跟进客户时，需要在一个弹层里看到订单 + 对应客户信息，
 * 并直接完成登记支付 / 取消订单（与 admin 销售订单页操作对齐）。
 */

export type OrderSheetCustomer = {
  name?: string | null
  phone?: string | null
  salesName?: string | null
  orderCount?: number
  totalAmountCents?: number
}

type OrderItem = {
  id: string
  productName: string
  skuCode: string
  unitPriceCents: number
  quantity: number
  amountCents: number
}

export type OrderDetail = {
  id: string
  orderNo: string
  status: string
  totalAmountCents: number
  paidAmountCents?: number | null
  refundedAmountCents: number
  paidAt?: string | null
  createdAt: string
  contactName?: string | null
  contactPhone?: string | null
  address?: string | null
  items: OrderItem[]
  customer?: { id: string; name: string; phone?: string | null } | null
}

type Props = {
  orderId: string | null
  customer?: OrderSheetCustomer | null
  /** 仅商家可操作；销售为只读 */
  canOperate?: boolean
  onClose: () => void
  /** 订单状态变化后通知页面刷新列表 */
  onChanged?: () => void
}

const DIALOG_ID = 'b-order-action-dialog'

const dateTimeText = (value?: string | null): string =>
  value ? value.slice(0, 16).replace('T', ' ') : '—'

export function OrderDetailSheet({ orderId, customer, canOperate = false, onClose, onChanged }: Props) {
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!orderId) {
      setOrder(null)
      setError('')
      return
    }
    let cancelled = false
    setOrder(null)
    setLoading(true)
    setError('')
    void api<OrderDetail>(`/sales-orders/${orderId}`)
      .then((detail) => {
        if (!cancelled) {
          setOrder(detail)
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : '订单加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [orderId])

  const reload = async (id: string) => {
    const detail = await api<OrderDetail>(`/sales-orders/${id}`)
    setOrder(detail)
  }

  const runAction = (action: 'pay' | 'cancel') => {
    if (!order || busy) {
      return
    }
    const isPay = action === 'pay'
    Dialog.open(DIALOG_ID, {
      title: isPay ? '登记支付' : '取消订单',
      content: isPay
        ? `确认已线下收到 ${formatCents(order.totalAmountCents)} 元？登记后订单进入发货流程，并生成预估佣金流水。`
        : '取消后订单不可恢复，客户需重新下单。确认取消该订单？',
      confirmText: isPay ? '确认登记' : '确认取消',
      cancelText: '再想想',
      onConfirm: async () => {
        Dialog.close(DIALOG_ID)
        setBusy(true)
        try {
          await api(`/sales-orders/${order.id}/${isPay ? 'register-payment' : 'cancel'}`, {
            method: 'POST',
            data: {},
          })
          await reload(order.id)
          toast(isPay ? '支付登记成功' : '订单已取消', 'success')
          onChanged?.()
        } catch (cause) {
          toast(cause instanceof Error ? cause.message : '操作失败', 'fail')
          // 状态可能已被超时关单等任务改变，刷新为最新态避免继续误操作
          await reload(order.id).catch(() => undefined)
          onChanged?.()
        } finally {
          setBusy(false)
        }
      },
      onCancel: () => Dialog.close(DIALOG_ID),
    })
  }

  if (!orderId) {
    return null
  }

  const pending = order?.status === 'pending_payment'
  const customerName = order?.customer?.name ?? customer?.name ?? order?.contactName ?? '—'
  const customerPhone = order?.customer?.phone ?? customer?.phone ?? order?.contactPhone ?? ''

  return (
    <>
      <View className="theme-sheet-mask" onClick={onClose}>
        <View className="theme-sheet b-order-sheet" onClick={(event) => event.stopPropagation()}>
          <View className="theme-sheet-head">
            <View className="b-order-head-main">
              <Text className="theme-sheet-title">订单详情</Text>
              <Text className="b-order-no">{order?.orderNo ?? '加载中…'}</Text>
            </View>
            <Text className="theme-sheet-close" onClick={onClose}>
              关闭
            </Text>
          </View>

          {loading && !order ? (
            <View className="b-order-placeholder">
              <Text className="muted">加载中…</Text>
            </View>
          ) : null}

          {error && !order ? (
            <View className="b-order-placeholder">
              <Text className="b-order-error">{error}</Text>
              <Text
                className="b-order-retry"
                onClick={() => {
                  setOrder(null)
                  setError('')
                  setLoading(true)
                  void reload(orderId)
                    .catch((cause) => {
                      setError(cause instanceof Error ? cause.message : '订单加载失败')
                    })
                    .finally(() => setLoading(false))
                }}
              >
                重新加载
              </Text>
            </View>
          ) : null}

          {order ? (
            <>
              <ScrollView scrollY className="b-order-body" style={{ height: '54vh' }}>
                <View className="b-order-status">
                  <Tag type={SALES_ORDER_STATUS_TONES[order.status] ?? 'default'}>
                    {statusLabel(SALES_ORDER_STATUS_LABELS, order.status)}
                  </Tag>
                  <Text className="b-order-amount">¥{formatCents(order.totalAmountCents)}</Text>
                </View>

                <View className="b-order-block">
                  <Text className="b-order-block-title">客户信息</Text>
                  <View className="b-order-line">
                    <Icon name="user" size={13} className="b-order-line-icon" />
                    <Text className="b-order-line-text">{customerName}</Text>
                  </View>
                  <View className="b-order-line">
                    <Icon name="phone" size={13} className="b-order-line-icon" />
                    <Text className="b-order-line-text">{customerPhone || '未留手机号'}</Text>
                  </View>
                  {customer?.salesName ? (
                    <View className="b-order-line">
                      <Icon name="users" size={13} className="b-order-line-icon" />
                      <Text className="b-order-line-text">归属销售：{customer.salesName}</Text>
                    </View>
                  ) : null}
                  {customer?.orderCount !== undefined ? (
                    <View className="b-order-line">
                      <Icon name="chart" size={13} className="b-order-line-icon" />
                      <Text className="b-order-line-text">
                        累计成交 {customer.orderCount} 单 ·{' '}
                        {formatCents(customer.totalAmountCents ?? 0)} 元
                      </Text>
                    </View>
                  ) : null}
                  <View className="b-order-line">
                    <Icon name="info" size={13} className="b-order-line-icon" />
                    <Text className="b-order-line-text">下单时间：{dateTimeText(order.createdAt)}</Text>
                  </View>
                </View>

                <View className="b-order-block">
                  <Text className="b-order-block-title">收货信息</Text>
                  <View className="b-order-line">
                    <Icon name="user" size={13} className="b-order-line-icon" />
                    <Text className="b-order-line-text">
                      {order.contactName || '—'}
                      {order.contactPhone ? ` · ${order.contactPhone}` : ''}
                    </Text>
                  </View>
                  <View className="b-order-line">
                    <Icon name="location" size={13} className="b-order-line-icon" />
                    <Text className="b-order-line-text">{order.address || '暂无收货地址'}</Text>
                  </View>
                </View>

                <View className="b-order-block">
                  <Text className="b-order-block-title">商品明细</Text>
                  {order.items.map((item) => (
                    <View key={item.id} className="b-order-item">
                      <View className="b-order-item-main">
                        <Text className="b-order-item-name">{item.productName}</Text>
                        <Text className="b-order-item-meta">
                          {item.skuCode} · ¥{formatCents(item.unitPriceCents)} × {item.quantity}
                        </Text>
                      </View>
                      <Text className="b-order-item-amount">¥{formatCents(item.amountCents)}</Text>
                    </View>
                  ))}
                  <View className="b-order-sum">
                    <Text className="b-order-sum-label">订单应付</Text>
                    <Text className="b-order-sum-value">¥{formatCents(order.totalAmountCents)}</Text>
                  </View>
                  {order.paidAt ? (
                    <View className="b-order-sum">
                      <Text className="b-order-sum-label">实付金额</Text>
                      <Text className="b-order-sum-value">
                        ¥{formatCents(order.paidAmountCents ?? order.totalAmountCents)}
                      </Text>
                    </View>
                  ) : null}
                  {order.refundedAmountCents > 0 ? (
                    <View className="b-order-sum">
                      <Text className="b-order-sum-label">已退金额</Text>
                      <Text className="b-order-sum-value b-order-sum-refund">
                        ¥{formatCents(order.refundedAmountCents)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {pending ? (
                  <Text className="b-order-hint">
                    {canOperate
                      ? '本商城由商家线下收款并登记确认。收到客户付款后点击「登记支付」，订单进入发货流程并通知客户；未付款可直接取消。待支付订单超 30 分钟未处理将自动取消。'
                      : '该客户订单尚未支付。登记支付 / 取消订单由商家操作，销售仅可查看。'}
                  </Text>
                ) : null}
              </ScrollView>

              <View className="b-order-actions">
                {canOperate && pending ? (
                  <>
                    <View
                      className={`b-order-btn b-order-btn-danger ${busy ? 'b-order-btn-busy' : ''}`}
                      onClick={() => runAction('cancel')}
                    >
                      取消订单
                    </View>
                    <View
                      className={`b-order-btn b-order-btn-primary ${busy ? 'b-order-btn-busy' : ''}`}
                      onClick={() => runAction('pay')}
                    >
                      {busy ? '处理中…' : '登记支付'}
                    </View>
                  </>
                ) : (
                  <View className="b-order-btn b-order-btn-ghost" onClick={onClose}>
                    关闭
                  </View>
                )}
              </View>
            </>
          ) : null}
        </View>
      </View>
      <Dialog id={DIALOG_ID} />
    </>
  )
}
