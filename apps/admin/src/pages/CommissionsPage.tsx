import { useRef, useState } from 'react'
import { Popconfirm, Button, Space, Tabs, Tag, Typography, message } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import {
  ModalForm,
  PageContainer,
  ProFormDatePicker,
  ProFormDependency,
  ProFormDigit,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components'
import { formatCents } from '@mall/shared'
import { api } from '../lib/api'

const { Text } = Typography

type CommissionRule = {
  id: string
  productId: string
  level: number
  rateType: 'percentage' | 'fixed'
  rateBps?: number | null
  fixedAmountCents?: number | null
  effectiveFrom: string
  effectiveTo?: string | null
  createdAt: string
}

type CommissionRecord = {
  id: string
  commissionNo: string
  orderId: string
  orderItemId: string
  level: number
  generation: number
  beneficiaryId: string
  beneficiaryType: string
  baseAmountCents: number
  rateType: 'percentage' | 'fixed'
  rateBps?: number | null
  fixedAmountCents?: number | null
  amountCents: number
  reversedAmountCents: number
  status: string
  selfPurchase: boolean
  note?: string | null
  createdAt: string
}

type OrderSettlement = {
  id: string
  orderId: string
  orderItemId: string
  supplyCostCents: number
  platformServiceFeeCents: number
  level1CommissionCents: number
  level2CommissionCents: number
  merchantIncomeCents: number
}

type OrderSplit = { settlements: OrderSettlement[]; commissions: CommissionRecord[] }

const STATUS_META: Record<string, { label: string; color: string }> = {
  estimated: { label: '预估', color: 'gold' },
  pending_reconciliation: { label: '待对账', color: 'cyan' },
  reconciling: { label: '对账中', color: 'blue' },
  reconciled: { label: '已对账', color: 'green' },
  settled: { label: '已结算', color: 'purple' },
  invalid: { label: '已作废', color: 'default' },
  disputed: { label: '争议', color: 'red' },
}

const bpsToPercent = (bps: number) => `${(bps / 100).toFixed(2)}%`

const BENEFICIARY_TYPE_LABELS: Record<string, string> = {
  merchant: '商家',
  partner: '合伙人',
  customer: '客户',
}

export default function CommissionsPage() {
  const ruleActionRef = useRef<ActionType>()
  const recordActionRef = useRef<ActionType>()
  const [split, setSplit] = useState<OrderSplit | null>(null)
  const [splitOrderId, setSplitOrderId] = useState('')

  const reloadAll = () => {
    ruleActionRef.current?.reload()
    recordActionRef.current?.reload()
  }

  const ruleColumns: ProColumns<CommissionRule>[] = [
    { title: '商品 ID', dataIndex: 'productId', width: 200, ellipsis: true, copyable: true },
    {
      title: '级别',
      dataIndex: 'level',
      width: 90,
      renderText: (value: number) => `${value} 级`,
    },
    {
      title: '类型',
      dataIndex: 'rateType',
      width: 90,
      renderText: (value: string) => (value === 'percentage' ? '比例' : '固定金额'),
    },
    {
      title: '比例',
      dataIndex: 'rateBps',
      width: 100,
      renderText: (value?: number | null) => (value !== null && value !== undefined ? bpsToPercent(value) : '—'),
    },
    {
      title: '固定金额',
      dataIndex: 'fixedAmountCents',
      width: 110,
      renderText: (value?: number | null) => (value !== null && value !== undefined ? formatCents(value) : '—'),
    },
    {
      title: '生效起',
      dataIndex: 'effectiveFrom',
      width: 110,
      renderText: (value: string) => value.slice(0, 16).replace('T', ' '),
    },
    {
      title: '生效止',
      dataIndex: 'effectiveTo',
      width: 110,
      renderText: (value?: string | null) => (value ? value.slice(0, 16).replace('T', ' ') : '长期'),
    },
  ]

  const recordColumns: ProColumns<CommissionRecord>[] = [
    { title: '佣金单号', dataIndex: 'commissionNo', width: 190, copyable: true },
    { title: '订单 ID', dataIndex: 'orderId', width: 160, ellipsis: true },
    {
      title: '级别',
      dataIndex: 'level',
      width: 80,
      renderText: (value: number) => `${value} 级`,
    },
    {
      title: '收益方',
      width: 170,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }} copyable={{ text: entity.beneficiaryId }}>
            {entity.beneficiaryId.slice(0, 14)}…
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {BENEFICIARY_TYPE_LABELS[entity.beneficiaryType] ?? entity.beneficiaryType}
          </Text>
        </Space>
      ),
    },
    {
      title: '基数',
      dataIndex: 'baseAmountCents',
      width: 100,
      renderText: (value: number) => formatCents(value),
    },
    {
      title: '金额',
      dataIndex: 'amountCents',
      width: 100,
      renderText: (value: number) => formatCents(value),
    },
    {
      title: '已冲销',
      dataIndex: 'reversedAmountCents',
      width: 100,
      renderText: (value: number) => (value > 0 ? formatCents(value) : '—'),
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
      dataIndex: 'note',
      width: 160,
      ellipsis: true,
      renderText: (value?: string | null) => value ?? '—',
    },
  ]

  const settlementColumns: ProColumns<OrderSettlement>[] = [
    { title: '订单项 ID', dataIndex: 'orderItemId', ellipsis: true },
    { title: '供货成本', dataIndex: 'supplyCostCents', renderText: (v: number) => formatCents(v) },
    {
      title: '平台服务费',
      dataIndex: 'platformServiceFeeCents',
      renderText: (v: number) => formatCents(v),
    },
    {
      title: '一级佣金',
      dataIndex: 'level1CommissionCents',
      renderText: (v: number) => formatCents(v),
    },
    {
      title: '二级佣金',
      dataIndex: 'level2CommissionCents',
      renderText: (v: number) => formatCents(v),
    },
    {
      title: '商家收入',
      dataIndex: 'merchantIncomeCents',
      renderText: (v: number) => formatCents(v),
    },
  ]

  return (
    <PageContainer
      header={{ title: '佣金管理', subTitle: '两级佣金规则与确认入账' }}
      content="配置商品一级/二级佣金规则，确认售后期结束的预估佣金，并按订单查询佣金拆分。"
    >
      <Tabs
        defaultActiveKey="records"
        items={[
          {
            key: 'records',
            label: '佣金记录',
            children: (
              <ProTable<CommissionRecord>
                rowKey="id"
                actionRef={recordActionRef}
                columns={recordColumns}
                search={false}
                headerTitle={
                  <Space>
                    <Popconfirm
                      title="确认将过保订单的预估佣金批量转为待对账？"
                      onConfirm={() => {
                        void (async () => {
                          try {
                            const result = await api<{ orders: number; updated: number }>(
                              '/commissions/confirm-eligible',
                              { method: 'POST' },
                            )
                            message.success(`已确认 ${result.updated} 条佣金（涉及 ${result.orders} 单）`)
                            reloadAll()
                          } catch (cause) {
                            message.error(cause instanceof Error ? cause.message : '操作失败')
                          }
                        })()
                      }}
                    >
                      <Button type="primary">确认入账</Button>
                    </Popconfirm>
                    <ModalForm<{ orderId: string }>
                      title="按订单查询佣金拆分"
                      width={420}
                      trigger={<Button>订单拆分查询</Button>}
                      onFinish={async (values) => {
                        try {
                          const orderId = values.orderId.trim()
                          const result = await api<OrderSplit>(`/commissions/order/${orderId}/split`)
                          setSplit(result)
                          setSplitOrderId(orderId)
                          return true
                        } catch (cause) {
                          message.error(cause instanceof Error ? cause.message : '查询失败')
                          return false
                        }
                      }}
                    >
                      <ProFormText
                        name="orderId"
                        label="订单 ID"
                        rules={[{ required: true, message: '请输入订单 ID' }]}
                      />
                    </ModalForm>
                  </Space>
                }
                options={{ reload: true, density: true, setting: true }}
                pagination={{ pageSize: 10 }}
                request={async () => {
                  const data = await api<CommissionRecord[]>('/commissions')
                  return { data, success: true }
                }}
              />
            ),
          },
          {
            key: 'rules',
            label: '佣金规则',
            children: (
              <ProTable<CommissionRule>
                rowKey="id"
                actionRef={ruleActionRef}
                columns={ruleColumns}
                search={false}
                headerTitle={
                  <ModalForm<{
                    productId: string
                    level: number
                    rateType: 'percentage' | 'fixed'
                    ratePercent?: number
                    fixedAmountYuan?: number
                    effectiveFrom: string
                    effectiveTo?: string
                  }>
                    title="新建佣金规则"
                    width={520}
                    trigger={<Button type="primary">新建规则</Button>}
                    onFinish={async (values) => {
                      try {
                        await api('/commissions/rules', {
                          method: 'POST',
                          body: JSON.stringify({
                            productId: values.productId.trim(),
                            level: values.level,
                            rateType: values.rateType,
                            rateBps:
                              values.rateType === 'percentage' && values.ratePercent !== undefined
                                ? Math.round(values.ratePercent * 100)
                                : undefined,
                            fixedAmountCents:
                              values.rateType === 'fixed' && values.fixedAmountYuan !== undefined
                                ? Math.round(values.fixedAmountYuan * 100)
                                : undefined,
                            effectiveFrom: new Date(values.effectiveFrom).toISOString(),
                            effectiveTo: values.effectiveTo
                              ? new Date(values.effectiveTo).toISOString()
                              : undefined,
                          }),
                        })
                        message.success('佣金规则已创建')
                        reloadAll()
                        return true
                      } catch (cause) {
                        message.error(cause instanceof Error ? cause.message : '操作失败')
                        return false
                      }
                    }}
                  >
                    <ProFormText
                      name="productId"
                      label="商品 ID"
                      rules={[{ required: true, message: '请输入商品 ID' }]}
                    />
                    <ProFormSelect
                      name="level"
                      label="佣金级别"
                      options={[
                        { label: '一级佣金', value: 1 },
                        { label: '二级佣金', value: 2 },
                      ]}
                      rules={[{ required: true, message: '请选择佣金级别' }]}
                    />
                    <ProFormRadio.Group
                      name="rateType"
                      label="计佣方式"
                      options={[
                        { label: '比例（按销售额万分比）', value: 'percentage' },
                        { label: '固定金额', value: 'fixed' },
                      ]}
                      rules={[{ required: true, message: '请选择计佣方式' }]}
                    />
                    <ProFormDependency name={['rateType']}>
                      {({ rateType }) =>
                        rateType === 'fixed' ? (
                          <ProFormDigit
                            name="fixedAmountYuan"
                            label="固定佣金（元）"
                            min={0.01}
                            fieldProps={{ precision: 2 }}
                            rules={[{ required: true, message: '请输入固定佣金金额' }]}
                          />
                        ) : (
                          <ProFormDigit
                            name="ratePercent"
                            label="佣金比例（%）"
                            min={0}
                            max={100}
                            rules={[{ required: true, message: '请输入佣金比例' }]}
                            extra="两级佣金比例之和不能超过商品佣金上限"
                          />
                        )
                      }
                    </ProFormDependency>
                    <ProFormDatePicker
                      name="effectiveFrom"
                      label="生效时间"
                      rules={[{ required: true, message: '请选择生效时间' }]}
                      fieldProps={{ showTime: true, format: 'YYYY-MM-DD HH:mm:ss' }}
                    />
                    <ProFormDatePicker
                      name="effectiveTo"
                      label="失效时间"
                      fieldProps={{ showTime: true, format: 'YYYY-MM-DD HH:mm:ss' }}
                      extra="不填则长期有效"
                    />
                  </ModalForm>
                }
                options={{ reload: true, density: true, setting: true }}
                pagination={{ pageSize: 10 }}
                request={async () => {
                  const data = await api<CommissionRule[]>('/commissions/rules')
                  return { data, success: true }
                }}
              />
            ),
          },
        ]}
      />

      {split ? (
        <ModalForm
          title={`订单佣金拆分 · ${splitOrderId}`}
          width={760}
          open={Boolean(split)}
          modalProps={{ onCancel: () => setSplit(null) }}
          onOpenChange={(open) => {
            if (!open) setSplit(null)
          }}
          submitter={false}
        >
          <Text strong>结算拆分（按订单项）</Text>
          <ProTable<OrderSettlement>
            rowKey="id"
            size="small"
            search={false}
            options={false}
            pagination={false}
            columns={settlementColumns}
            dataSource={split.settlements}
            style={{ marginTop: 8 }}
          />
          <Text strong style={{ display: 'block', marginTop: 16 }}>
            佣金记录
          </Text>
          <ProTable<CommissionRecord>
            rowKey="id"
            size="small"
            search={false}
            options={false}
            pagination={false}
            columns={[
              { title: '佣金单号', dataIndex: 'commissionNo', copyable: true },
              { title: '级别', dataIndex: 'level', width: 70, renderText: (v: number) => `${v} 级` },
              {
                title: '收益方',
                dataIndex: 'beneficiaryId',
                width: 150,
                ellipsis: true,
                copyable: true,
              },
              {
                title: '金额',
                dataIndex: 'amountCents',
                width: 100,
                renderText: (v: number) => formatCents(v),
              },
              {
                title: '已冲销',
                dataIndex: 'reversedAmountCents',
                width: 100,
                renderText: (v: number) => (v > 0 ? formatCents(v) : '—'),
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
            ]}
            dataSource={split.commissions}
            style={{ marginTop: 8 }}
          />
        </ModalForm>
      ) : null}
    </PageContainer>
  )
}
