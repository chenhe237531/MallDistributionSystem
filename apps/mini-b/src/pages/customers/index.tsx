import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { formatCents } from '@mall/shared'
import { api, ensureLogin } from '../../lib/api'
import { Cell, CellGroup, Empty, Tag } from '@nutui/nutui-react-taro'
import { useTheme } from '../../lib/theme'
import { PageToast, toast } from '../../components/feedback'
import { Icon } from '../../components/Icon'
import { OrderDetailSheet } from '../../components/OrderDetailSheet'

type Me = { roles: string[] }
type PendingOrder = {
  id: string
  orderNo: string
  totalAmountCents: number
  createdAt: string
  itemSummary: string
  itemCount: number
}
type CustomerRow = {
  customerId: string
  name: string
  phone: string
  orderCount: number
  totalAmountCents: number
  avgOrderCents: number | null
  reportStatus: string | null
  salesName?: string | null
  pendingOrders?: PendingOrder[]
  pendingOrderCount?: number
  pendingAmountCents?: number
}

const dateTimeText = (value: string): string => value.slice(5, 16).replace('T', ' ')

export default function Customers() {
  const { themeClass } = useTheme()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [selected, setSelected] = useState<{ orderId: string; customer: CustomerRow } | null>(null)

  const load = async () => {
    const me = await api<Me>('/auth/me')
    setRoles(me.roles)
    const sales = me.roles.includes('sales')
    const list = sales
      ? await api<CustomerRow[]>('/sales-workbench/customers')
      : await api<CustomerRow[]>('/sales-workbench/merchant/customers')
    setCustomers(list)
    return list
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
    })
  })

  const reload = () => {
    void load()
      .then((list) => {
        // 弹层内展示的客户统计同步为最新（登记支付后成交单数 / 金额会变化）
        setSelected((current) => {
          if (!current) {
            return current
          }
          const fresh = list.find((item) => item.customerId === current.customer.customerId)
          return fresh ? { ...current, customer: fresh } : current
        })
      })
      .catch((cause) => {
        toast(cause instanceof Error ? cause.message : '刷新失败', 'fail')
      })
  }

  const isSales = roles.includes('sales')
  const isMerchant = roles.includes('merchant')

  return (
    <View className={`page ${themeClass}`}>
      <PageToast />
      <View className="section">
        <Text className="section-title">{isSales ? '我负责的客户' : '本店客户'}</Text>
        {customers.length === 0 ? <Empty description="暂无客户" /> : null}
        {customers.map((customer) => {
          const pendingOrders = customer.pendingOrders ?? []
          return (
            <View key={customer.customerId} className="card">
              <View className="row">
                <Text className="cust-name">{customer.name}</Text>
                <Tag type="primary">{customer.reportStatus ?? '无报告'}</Tag>
              </View>
              <Text className="cust-phone">{customer.phone}</Text>
              <CellGroup className="cust-stats">
                <Cell
                  title="成交 / 客单价"
                  extra={
                    <Text className="cust-stat">
                      {customer.orderCount} 单 ·{' '}
                      {customer.avgOrderCents === null
                        ? '—'
                        : `${formatCents(customer.avgOrderCents)} 元`}
                    </Text>
                  }
                />
                <Cell
                  title="累计成交"
                  extra={
                    <Text className="cust-stat">{formatCents(customer.totalAmountCents)} 元</Text>
                  }
                />
              </CellGroup>
              {customer.salesName ? (
                <Text className="muted">归属销售：{customer.salesName}</Text>
              ) : null}

              {pendingOrders.length > 0 ? (
                <View className="cust-pending">
                  <View className="cust-pending-head">
                    <Text className="cust-pending-title">待支付订单 {pendingOrders.length}</Text>
                    <Text className="cust-pending-sum">
                      待收 {formatCents(customer.pendingAmountCents ?? 0)} 元
                    </Text>
                  </View>
                  {pendingOrders.map((order) => (
                    <View
                      key={order.id}
                      className="cust-pending-item"
                      onClick={() => setSelected({ orderId: order.id, customer })}
                    >
                      <View className="cust-pending-main">
                        <Text className="cust-pending-no">{order.orderNo}</Text>
                        <Text className="cust-pending-sub">
                          {order.itemSummary || `共 ${order.itemCount} 件`} ·{' '}
                          {dateTimeText(order.createdAt)}
                        </Text>
                      </View>
                      <View className="cust-pending-side">
                        <Text className="cust-pending-amount">
                          {formatCents(order.totalAmountCents)} 元
                        </Text>
                        <Text className="cust-pending-action">
                          {isMerchant ? '查看 / 处理' : '查看详情'}
                        </Text>
                      </View>
                      <Icon name="arrowRight" size={14} className="cust-pending-arrow" />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>

      <OrderDetailSheet
        orderId={selected?.orderId ?? null}
        customer={
          selected
            ? {
                name: selected.customer.name,
                phone: selected.customer.phone,
                salesName: selected.customer.salesName,
                orderCount: selected.customer.orderCount,
                totalAmountCents: selected.customer.totalAmountCents,
              }
            : null
        }
        canOperate={isMerchant}
        onClose={() => setSelected(null)}
        onChanged={reload}
      />
    </View>
  )
}
