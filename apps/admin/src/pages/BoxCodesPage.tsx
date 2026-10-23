import { useRef, useState } from 'react'
import { Button, Select, Space, Tag, Typography, message } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { ModalForm, PageContainer, ProFormText, ProTable } from '@ant-design/pro-components'
import { api } from '../lib/api'

const { Text } = Typography

type BoxCode = {
  id: string
  code: string
  qrPayload: string
  procurementOrderId: string
  productId: string
  productName: string
  skuCode: string
  batchNo: string
  channelId: string
  merchantId: string
  status: string
  voidReason?: string | null
  createdAt: string
}

type BoxLabel = {
  code: string
  qrPayload: string
  productName: string
  skuCode: string
  batchNo: string
  channelId: string
  status: string
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  generated: { label: '已生成', color: 'gold' },
  active: { label: '已激活', color: 'green' },
  used: { label: '已使用', color: 'blue' },
  voided: { label: '已作废', color: 'default' },
}

const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

export default function BoxCodesPage() {
  const actionRef = useRef<ActionType>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [labelsVisible, setLabelsVisible] = useState(false)
  const [labels, setLabels] = useState<BoxLabel[]>([])
  const [labelsOrderId, setLabelsOrderId] = useState('')

  const reload = () => actionRef.current?.reload()

  const columns: ProColumns<BoxCode>[] = [
    { title: '盒码', dataIndex: 'code', width: 170, copyable: true },
    {
      title: '商品',
      width: 200,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 12 }}>
            {entity.productName}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {entity.skuCode} · 批次 {entity.batchNo}
          </Text>
        </Space>
      ),
    },
    { title: '采购单 ID', dataIndex: 'procurementOrderId', width: 130, ellipsis: true },
    { title: '渠道 ID', dataIndex: 'channelId', width: 130, ellipsis: true },
    {
      title: '激活链接',
      dataIndex: 'qrPayload',
      width: 150,
      ellipsis: true,
      render: (_, entity) => (
        <Text copyable={{ text: entity.qrPayload }} style={{ fontSize: 12 }}>
          {entity.qrPayload}
        </Text>
      ),
    },
    {
      title: '生成时间',
      dataIndex: 'createdAt',
      width: 110,
      renderText: (value: string) => value.slice(0, 16).replace('T', ' '),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, entity) => {
        const meta = STATUS_META[entity.status] ?? { label: entity.status, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '备注',
      dataIndex: 'voidReason',
      width: 150,
      ellipsis: true,
      renderText: (value?: string | null) => value ?? '—',
    },
  ]

  return (
    <PageContainer
      header={{ title: '盒码管理', subTitle: '生成、冻结与标签导出' }}
      content="按采购单生成检测盒二维码，批量冻结未激活盒码并补码，按采购单查看与导出标签。"
    >
      <ProTable<BoxCode>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        params={{ status: statusFilter }}
        headerTitle={
          <Space>
            <Select
              allowClear
              placeholder="全部状态"
              style={{ width: 140 }}
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
            />
            <ModalForm<{ procurementOrderId: string }>
              title="生成盒码"
              width={420}
              trigger={<Button type="primary">生成盒码</Button>}
              onFinish={async (values) => {
                try {
                  const created = await api<BoxCode[]>('/box-codes/generate', {
                    method: 'POST',
                    body: JSON.stringify({ procurementOrderId: values.procurementOrderId.trim() }),
                  })
                  message.success(`已生成 ${created.length} 个盒码`)
                  reload()
                  return true
                } catch (cause) {
                  message.error(cause instanceof Error ? cause.message : '操作失败')
                  return false
                }
              }}
            >
              <ProFormText
                name="procurementOrderId"
                label="采购单 ID"
                rules={[{ required: true, message: '请输入采购单 ID' }]}
                extra="按采购单商品明细数量一次性生成，无需填写数量"
              />
            </ModalForm>
            <ModalForm<{ channelId: string }>
              title="冻结未激活盒码"
              width={420}
              trigger={<Button>冻结未激活</Button>}
              onFinish={async (values) => {
                try {
                  const result = await api<{ frozen: number; replaced: number; channelCode: string }>(
                    '/box-codes/freeze-unactivated',
                    { method: 'POST', body: JSON.stringify({ channelId: values.channelId.trim() }) },
                  )
                  message.success(
                    `渠道 ${result.channelCode} 已冻结并补码 ${result.replaced} 个未激活盒码`,
                  )
                  reload()
                  return true
                } catch (cause) {
                  message.error(cause instanceof Error ? cause.message : '操作失败')
                  return false
                }
              }}
            >
              <ProFormText
                name="channelId"
                label="渠道 ID"
                rules={[{ required: true, message: '请输入渠道 ID' }]}
                extra="该渠道下所有未激活盒码将作废并生成新码"
              />
            </ModalForm>
            <ModalForm<{ procurementOrderId: string }>
              title="按采购单查看标签"
              width={420}
              trigger={<Button>查看标签</Button>}
              onFinish={async (values) => {
                try {
                  const orderId = values.procurementOrderId.trim()
                  const data = await api<BoxLabel[]>(`/box-codes/labels/${orderId}`)
                  setLabels(data)
                  setLabelsOrderId(orderId)
                  setLabelsVisible(true)
                  return true
                } catch (cause) {
                  message.error(cause instanceof Error ? cause.message : '查询失败')
                  return false
                }
              }}
            >
              <ProFormText
                name="procurementOrderId"
                label="采购单 ID"
                rules={[{ required: true, message: '请输入采购单 ID' }]}
              />
            </ModalForm>
          </Space>
        }
        options={{ reload: true, density: true, setting: true }}
        pagination={{ pageSize: 10 }}
        request={async (params) => {
          const data = await api<BoxCode[]>('/box-codes')
          const status = (params as { status?: string }).status
          return { data: status ? data.filter((item) => item.status === status) : data, success: true }
        }}
      />

      {labelsVisible ? (
        <ModalForm
          title={`盒码标签 · ${labelsOrderId}`}
          width={720}
          open={labelsVisible}
          modalProps={{ onCancel: () => setLabelsVisible(false) }}
          onOpenChange={setLabelsVisible}
          submitter={false}
        >
          <ProTable<BoxLabel>
            rowKey="code"
            size="small"
            search={false}
            options={false}
            pagination={{ pageSize: 8 }}
            columns={[
              { title: '盒码', dataIndex: 'code', copyable: true },
              { title: '商品', dataIndex: 'productName' },
              { title: 'SKU', dataIndex: 'skuCode', width: 120 },
              { title: '批次', dataIndex: 'batchNo', width: 110 },
              {
                title: '状态',
                dataIndex: 'status',
                width: 90,
                render: (_, entity) => {
                  const meta = STATUS_META[entity.status] ?? { label: entity.status, color: 'default' }
                  return <Tag color={meta.color}>{meta.label}</Tag>
                },
              },
            ]}
            dataSource={labels}
          />
        </ModalForm>
      ) : null}
    </PageContainer>
  )
}
