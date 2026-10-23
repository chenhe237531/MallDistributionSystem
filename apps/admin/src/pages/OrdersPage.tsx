import { useRef, useState } from 'react'
import { Popconfirm, Select, Space, Tag, Typography, message } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { ModalForm, PageContainer, ProFormDigit, ProFormTextArea, ProTable } from '@ant-design/pro-components'
import { formatCents } from '@mall/shared'
import { api } from '../lib/api'

const { Text } = Typography

type OrderItem = {
  id: string
  productName: string
  skuCode: string
  unitPriceCents: number
  quantity: number
  amountCents: number
  refundedQuantity: number
  refundedAmountCents: number
}

type SalesOrder = {
  id: string
  orderNo: string
  status: string
  totalAmountCents: number
  paidAmountCents?: number | null
  refundedAmountCents: number
  paidAt?: string | null
  shippedAt?: string | null
  completedAt?: string | null
  contactName: string
  contactPhone: string
  address?: string | null
  createdAt: string
  items: OrderItem[]
  merchant?: { id: string; name: string; organization?: { name: string } | null } | null
  customer?: { id: string; name: string; phone?: string | null } | null
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending_payment: { label: '待支付', color: 'gold' },
  paid: { label: '已支付', color: 'green' },
  pending_shipment: { label: '待发货', color: 'cyan' },
  shipped: { label: '已发货', color: 'blue' },
  pending_sampling: { label: '待采样', color: 'purple' },
  testing: { label: '检测中', color: 'geekblue' },
  report_ready: { label: '报告已出', color: 'orange' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
  refunding: { label: '退款中', color: 'volcano' },
  refunded: { label: '已退款', color: 'red' },
  after_sale: { label: '售后中', color: 'volcano' },
}

const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

export default function OrdersPage() {
  const actionRef = useRef<ActionType>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [payTarget, setPayTarget] = useState<SalesOrder | null>(null)
  const [refundTarget, setRefundTarget] = useState<SalesOrder | null>(null)

  const reload = () => actionRef.current?.reload()

  const runAction = async (action: () => Promise<unknown>, successText: string) => {
    try {
      await action()
      message.success(successText)
      reload()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  const simpleAction = (orderId: string, path: string, successText: string) => () =>
    runAction(() => api(`/sales-orders/${orderId}/${path}`), successText)

  const columns: ProColumns<SalesOrder>[] = [
    { title: '订单号', dataIndex: 'orderNo', width: 190, copyable: true },
    {
      title: '商品',
      width: 220,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          {entity.items.slice(0, 2).map((item) => (
            <Text key={item.id} style={{ fontSize: 12 }}>
              {item.productName} × {item.quantity}
            </Text>
          ))}
          {entity.items.length > 2 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              等 {entity.items.length} 项
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: '商家',
      width: 130,
      render: (_, entity) => entity.merchant?.organization?.name ?? entity.merchant?.name ?? '—',
    },
    {
      title: '客户',
      width: 130,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{entity.contactName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {entity.contactPhone}
          </Text>
        </Space>
      ),
    },
    {
      title: '订单金额',
      dataIndex: 'totalAmountCents',
      width: 110,
      renderText: (value: number) => formatCents(value),
    },
    {
      title: '已退',
      dataIndex: 'refundedAmountCents',
      width: 100,
      renderText: (value: number) => (value > 0 ? formatCents(value) : '—'),
    },
    {
      title: '下单时间',
      dataIndex: 'createdAt',
      width: 110,
      renderText: (value: string) => value.slice(0, 16).replace('T', ' '),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 95,
      render: (_, entity) => {
        const meta = STATUS_META[entity.status] ?? { label: entity.status, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 230,
      render: (_, entity) => {
        const actions: React.ReactNode[] = []
        if (entity.status === 'pending_payment') {
          actions.push(
            <a key="pay" onClick={() => setPayTarget(entity)}>
              登记支付
            </a>,
            <Popconfirm
              key="cancel"
              title="确认取消该订单？"
              onConfirm={() => simpleAction(entity.id, 'cancel', '订单已取消')()}
            >
              <a>取消订单</a>
            </Popconfirm>,
          )
        }
        if (entity.status === 'paid' || entity.status === 'pending_shipment') {
          actions.push(
            <Popconfirm
              key="ship"
              title="确认发货？"
              onConfirm={() => simpleAction(entity.id, 'ship', '已发货')()}
            >
              <a>发货</a>
            </Popconfirm>,
          )
        }
        if (entity.status === 'shipped') {
          actions.push(
            <Popconfirm
              key="deliver"
              title="确认已送达？"
              onConfirm={() => simpleAction(entity.id, 'deliver', '已确认送达')()}
            >
              <a>确认送达</a>
            </Popconfirm>,
            <Popconfirm
              key="testing"
              title="确认进入检测？"
              onConfirm={() => simpleAction(entity.id, 'mark-testing', '已标记检测中')()}
            >
              <a>标记检测中</a>
            </Popconfirm>,
          )
        }
        if (entity.status === 'pending_sampling') {
          actions.push(
            <Popconfirm
              key="testing"
              title="确认进入检测？"
              onConfirm={() => simpleAction(entity.id, 'mark-testing', '已标记检测中')()}
            >
              <a>标记检测中</a>
            </Popconfirm>,
          )
        }
        if (entity.status === 'testing') {
          actions.push(
            <Popconfirm
              key="report"
              title="确认报告已出？"
              onConfirm={() => simpleAction(entity.id, 'mark-report-ready', '已标记报告已出')()}
            >
              <a>标记报告已出</a>
            </Popconfirm>,
          )
        }
        if (entity.status === 'report_ready') {
          actions.push(
            <Popconfirm
              key="complete"
              title="确认完成该订单？"
              onConfirm={() => simpleAction(entity.id, 'complete', '订单已完成')()}
            >
              <a>完成订单</a>
            </Popconfirm>,
          )
        }
        if (!['pending_payment', 'cancelled', 'refunded'].includes(entity.status)) {
          actions.push(
            <a key="refund" onClick={() => setRefundTarget(entity)}>
              退款
            </a>,
          )
        }
        return actions.length ? actions : [<Text key="none" type="secondary">—</Text>]
      },
    },
  ]

  return (
    <PageContainer
      header={{ title: '销售订单', subTitle: '订单全生命周期管理' }}
      content="跟进支付、发货、检测与售后各环节，处理超时未付订单与退款。"
    >
      <ProTable<SalesOrder>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        params={{ status: statusFilter }}
        headerTitle={
          <Select
            allowClear
            placeholder="全部状态"
            style={{ width: 160 }}
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
          />
        }
        options={{ reload: true, density: true, setting: true }}
        pagination={{ pageSize: 10 }}
        request={async (params) => {
          const data = await api<SalesOrder[]>('/sales-orders')
          const status = (params as { status?: string }).status
          return { data: status ? data.filter((item) => item.status === status) : data, success: true }
        }}
      />

      <ModalForm<{ paidAmountYuan?: number }>
        title={`登记支付 · ${payTarget?.orderNo ?? ''}`}
        width={420}
        open={Boolean(payTarget)}
        modalProps={{ onCancel: () => setPayTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setPayTarget(null)
        }}
        onFinish={async (values) => {
          if (!payTarget) return false
          try {
            await api(`/sales-orders/${payTarget.id}/register-payment`, {
              method: 'POST',
              body: JSON.stringify({
                paidAmountCents:
                  values.paidAmountYuan !== undefined && values.paidAmountYuan !== null
                    ? Math.round(values.paidAmountYuan * 100)
                    : undefined,
              }),
            })
            message.success('支付已登记')
            setPayTarget(null)
            reload()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '操作失败')
            return false
          }
        }}
      >
        <ProFormDigit
          name="paidAmountYuan"
          label="实付金额（元）"
          min={0.01}
          extra={`不填默认按订单全额 ${payTarget ? formatCents(payTarget.totalAmountCents) : '—'} 登记`}
        />
      </ModalForm>

      <ModalForm<{ reason?: string }>
        title={`订单退款 · ${refundTarget?.orderNo ?? ''}`}
        width={440}
        open={Boolean(refundTarget)}
        modalProps={{ onCancel: () => setRefundTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setRefundTarget(null)
        }}
        onFinish={async (values) => {
          if (!refundTarget) return false
          try {
            await api(`/sales-orders/${refundTarget.id}/refund`, {
              method: 'POST',
              body: JSON.stringify({ reason: values.reason || undefined }),
            })
            message.success('退款已提交')
            setRefundTarget(null)
            reload()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '操作失败')
            return false
          }
        }}
      >
        <ProFormTextArea
          name="reason"
          label="退款原因"
          placeholder="选填"
          extra="默认按各商品剩余可退数量整单退款"
        />
        {refundTarget && refundTarget.refundedAmountCents > 0 ? (
          <Text type="secondary">已累计退款 {formatCents(refundTarget.refundedAmountCents)}</Text>
        ) : null}
      </ModalForm>
    </PageContainer>
  )
}
