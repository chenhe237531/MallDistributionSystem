import { useRef } from 'react'
import { Popconfirm, Space, Tag, Typography, message } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import { formatCents } from '@mall/shared'
import { api } from '../lib/api'

const { Text } = Typography

type ProcurementItem = {
  id: string
  productName: string
  skuCode: string
  batchNo: string
  supplyPriceCents: number
  quantity: number
  amountCents: number
}

type ProcurementOrder = {
  id: string
  orderNo: string
  status: string
  totalAmountCents: number
  remark?: string | null
  createdAt: string
  items: ProcurementItem[]
  supplier?: { id: string; name: string; organization?: { name: string } | null } | null
  merchant?: { id: string; name: string; organization?: { name: string } | null } | null
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  deducted: { label: '已扣款', color: 'gold' },
  pending_shipment: { label: '待发货', color: 'cyan' },
  shipped: { label: '已发货', color: 'blue' },
  received: { label: '已收货', color: 'green' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
  after_sale: { label: '售后中', color: 'volcano' },
  refunded: { label: '已退款', color: 'red' },
}

export default function ProcurementPage() {
  const actionRef = useRef<ActionType>()

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
    runAction(() => api(`/procurement-orders/${orderId}/${path}`), successText)

  const columns: ProColumns<ProcurementOrder>[] = [
    { title: '采购单号', dataIndex: 'orderNo', width: 190, copyable: true },
    {
      title: '商品明细',
      width: 230,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          {entity.items.slice(0, 2).map((item) => (
            <Text key={item.id} style={{ fontSize: 12 }}>
              {item.productName} × {item.quantity}（批次 {item.batchNo}）
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
      title: '供应商',
      width: 130,
      render: (_, entity) => entity.supplier?.organization?.name ?? entity.supplier?.name ?? '—',
    },
    {
      title: '采购金额',
      dataIndex: 'totalAmountCents',
      width: 110,
      renderText: (value: number) => formatCents(value),
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
      width: 180,
      render: (_, entity) => {
        const actions: React.ReactNode[] = []
        if (entity.status === 'deducted') {
          actions.push(
            <Popconfirm
              key="confirm"
              title="确认该采购单？"
              onConfirm={() => simpleAction(entity.id, 'confirm', '采购单已确认')()}
            >
              <a>确认采购</a>
            </Popconfirm>,
          )
        }
        if (entity.status === 'pending_shipment') {
          actions.push(
            <Popconfirm
              key="ship"
              title="确认发货？"
              onConfirm={() => simpleAction(entity.id, 'ship', '采购单已发货')()}
            >
              <a>发货</a>
            </Popconfirm>,
          )
        }
        if (entity.status === 'received') {
          actions.push(
            <Popconfirm
              key="complete"
              title="确认完成该采购单？"
              onConfirm={() => simpleAction(entity.id, 'complete', '采购单已完成')()}
            >
              <a>完成采购单</a>
            </Popconfirm>,
          )
        }
        if (entity.status === 'received' || entity.status === 'completed') {
          actions.push(
            <Popconfirm
              key="refund"
              title="确认退款并回补库存？该操作将作废关联盒码"
              onConfirm={() => simpleAction(entity.id, 'refund', '采购单已退款')()}
            >
              <a>退款</a>
            </Popconfirm>,
          )
        }
        return actions.length ? actions : [<Text key="none" type="secondary">—</Text>]
      },
    },
  ]

  return (
    <PageContainer
      header={{ title: '采购单', subTitle: '平台采购单协同' }}
      content="跟进商家采购单的确认、发货、收货完成与退款流程。"
    >
      <ProTable<ProcurementOrder>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        options={{ reload: true, density: true, setting: true }}
        pagination={{ pageSize: 10 }}
        request={async () => {
          const data = await api<ProcurementOrder[]>('/procurement-orders')
          return { data, success: true }
        }}
      />
    </PageContainer>
  )
}
