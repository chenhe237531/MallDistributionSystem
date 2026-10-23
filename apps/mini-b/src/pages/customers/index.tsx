import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { formatCents } from '@mall/shared'
import { api, ensureLogin } from '../../lib/api'
import { Cell, CellGroup, Empty, Tag } from '@nutui/nutui-react-taro'

type Me = { roles: string[] }
type CustomerRow = {
  customerId: string
  name: string
  phone: string
  orderCount: number
  totalAmountCents: number
  avgOrderCents: number | null
  reportStatus: string | null
  salesName?: string | null
}

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [isSales, setIsSales] = useState(false)

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void (async () => {
      const me = await api<Me>('/auth/me')
      const sales = me.roles.includes('sales')
      setIsSales(sales)
      const list = sales
        ? await api<CustomerRow[]>('/sales-workbench/customers')
        : await api<CustomerRow[]>('/sales-workbench/merchant/customers')
      setCustomers(list)
    })().catch((cause) => {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
    })
  })

  return (
    <View className="page">
      <View className="section">
        <Text className="section-title">{isSales ? '我负责的客户' : '本店客户'}</Text>
        {customers.length === 0 ? <Empty description="暂无客户" /> : null}
        {customers.map((customer) => (
          <View key={customer.customerId} className="card">
            <View className="row">
              <Text className="cust-name">{customer.name}</Text>
              <Tag type="primary">{customer.reportStatus ?? '无报告'}</Tag>
            </View>
            <Text className="muted">{customer.phone}</Text>
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
          </View>
        ))}
      </View>
    </View>
  )
}
