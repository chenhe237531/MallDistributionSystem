import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { formatCents } from '@mall/shared'
import { api, ensureLogin } from '../../lib/api'

type Me = { roles: string[] }
type Order = { id: string; orderNo: string; status: string; totalAmountCents: number }
type Commission = { id: string; level: number; amountCents: number; status: string }
type Statement = {
  id: string
  statementNo: string
  period: string
  totalPayableCents: number
  status: string
}
type Performance = {
  customerCount: number
  orderCount: number
  totalAmountCents: number
  avgOrderCents: number | null
}

export default function Business() {
  const [orders, setOrders] = useState<Order[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [statements, setStatements] = useState<Statement[]>([])
  const [performance, setPerformance] = useState<Performance | null>(null)
  const [role, setRole] = useState('')

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void (async () => {
      const me = await api<Me>('/auth/me')
      setRole(me.roles.includes('sales') ? 'sales' : me.roles.includes('merchant') ? 'merchant' : '')
      if (me.roles.includes('sales')) {
        setPerformance(await api<Performance>('/sales-workbench/performance'))
      }
      if (me.roles.includes('merchant')) {
        const [orderList, commissionList, statementList] = await Promise.all([
          api<Order[]>('/sales-orders'),
          api<Commission[]>('/commissions'),
          api<Statement[]>('/statements'),
        ])
        setOrders(orderList)
        setCommissions(commissionList)
        setStatements(statementList)
      }
    })().catch((cause) => {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
    })
  })

  return (
    <View className="page">
      {performance ? (
        <View className="hero">
          <Text className="hero-role">销售业绩</Text>
          <Text className="hero-title">{formatCents(performance.totalAmountCents)} 元</Text>
          <Text className="hero-status">
            {performance.customerCount} 位客户 · {performance.orderCount} 单 · 客单价{' '}
            {performance.avgOrderCents === null ? '—' : formatCents(performance.avgOrderCents)}
          </Text>
        </View>
      ) : null}

      {role === 'merchant' ? (
        <View className="hero">
          <Text className="hero-role">经营概览</Text>
          <Text className="hero-title">{orders.length} 笔订单</Text>
          <Text className="hero-status">
            {commissions.length} 条佣金 · {statements.length} 份对账单
          </Text>
        </View>
      ) : null}

      {role === 'merchant' ? (
        <View className="section">
          <Text className="section-title">订单</Text>
          {orders.length === 0 ? (
            <Text className="muted">暂无订单</Text>
          ) : (
            orders.map((order) => (
              <View key={order.id} className="card">
                <View className="row">
                  <Text>{order.orderNo}</Text>
                  <Text className="tag">{order.status}</Text>
                </View>
                <Text>{formatCents(order.totalAmountCents)} 元</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {role === 'merchant' ? (
        <View className="section">
          <Text className="section-title">佣金支出</Text>
          {commissions.length === 0 ? (
            <Text className="muted">暂无佣金记录</Text>
          ) : (
            commissions.slice(0, 10).map((commission) => (
              <View key={commission.id} className="card">
                <View className="row">
                  <Text>{commission.level} 级佣金</Text>
                  <Text>{formatCents(commission.amountCents)} 元</Text>
                </View>
                <Text className="muted">{commission.status}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {role === 'merchant' ? (
        <View className="section">
          <Text className="section-title">月度对账单</Text>
          {statements.length === 0 ? (
            <Text className="muted">暂无对账单，平台生成后会在此展示</Text>
          ) : (
            statements.map((statement) => (
              <View key={statement.id} className="card">
                <View className="row">
                  <Text>
                    {statement.period} · {statement.statementNo}
                  </Text>
                  <Text className="tag">{statement.status}</Text>
                </View>
                <Text>{formatCents(statement.totalPayableCents)} 元</Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  )
}
