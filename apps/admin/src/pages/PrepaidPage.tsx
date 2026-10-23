import { useEffect, useState } from 'react'
import { Button, Popconfirm, Space, Tabs, Tag, Typography, message } from 'antd'
import type { ProColumns } from '@ant-design/pro-components'
import {
  ModalForm,
  PageContainer,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components'
import { formatCents } from '@mall/shared'
import { api } from '../lib/api'

const { Text } = Typography

type MerchantBrief = {
  id: string
  name: string
  phone?: string | null
  organization?: { name: string } | null
}

type PrepaidAccount = {
  id: string
  merchantId: string
  merchant?: MerchantBrief | null
  availableCents: number
  frozenCents: number
  totalRechargeCents: number
  totalDeductedCents: number
  adjustmentCents: number
  status: string
  createdAt: string
}

type RechargeOrder = {
  id: string
  rechargeNo: string
  merchantId: string
  merchant?: MerchantBrief | null
  amountCents: number
  paidAmountCents?: number | null
  voucherUrl?: string | null
  payerName?: string | null
  status: string
  note?: string | null
  creditedAt?: string | null
  createdAt: string
}

const ACCOUNT_STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: '正常', color: 'green' },
  locked: { label: '已锁定', color: 'red' },
}

const RECHARGE_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '待入账', color: 'gold' },
  pending_review: { label: '待人工核验', color: 'orange' },
  credited: { label: '已入账', color: 'green' },
  rejected: { label: '已拒绝', color: 'default' },
}

const merchantName = (merchant?: MerchantBrief | null) =>
  merchant?.organization?.name ?? merchant?.name ?? '—'

export default function PrepaidPage() {
  const [accounts, setAccounts] = useState<PrepaidAccount[]>([])
  const [recharges, setRecharges] = useState<RechargeOrder[]>([])
  const [loaded, setLoaded] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState<PrepaidAccount | null>(null)
  const [lockTarget, setLockTarget] = useState<PrepaidAccount | null>(null)
  const [rejectTarget, setRejectTarget] = useState<RechargeOrder | null>(null)

  const loadAll = async () => {
    try {
      const [accountList, rechargeList] = await Promise.all([
        api<PrepaidAccount[]>('/prepaid/accounts'),
        api<RechargeOrder[]>('/prepaid/recharges'),
      ])
      setAccounts(accountList)
      setRecharges(rechargeList)
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '加载预付款数据失败')
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const accountColumns: ProColumns<PrepaidAccount>[] = [
    {
      title: '商家',
      width: 160,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 12 }}>
            {merchantName(entity.merchant)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {entity.merchant?.phone ?? '—'}
          </Text>
        </Space>
      ),
    },
    {
      title: '可用余额',
      dataIndex: 'availableCents',
      width: 110,
      renderText: (value: number) => formatCents(value),
    },
    {
      title: '冻结金额',
      dataIndex: 'frozenCents',
      width: 110,
      renderText: (value: number) => formatCents(value),
    },
    {
      title: '累计充值',
      dataIndex: 'totalRechargeCents',
      width: 110,
      renderText: (value: number) => formatCents(value),
    },
    {
      title: '累计扣除',
      dataIndex: 'totalDeductedCents',
      width: 110,
      renderText: (value: number) => formatCents(value),
    },
    {
      title: '累计调整',
      dataIndex: 'adjustmentCents',
      width: 110,
      renderText: (value: number) => formatCents(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, entity) => {
        const meta = ACCOUNT_STATUS_META[entity.status] ?? { label: entity.status, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      render: (_, entity) => [
        <a key="adjust" onClick={() => setAdjustTarget(entity)}>
          调整
        </a>,
        entity.status === 'locked' ? (
          <Popconfirm
            key="unlock"
            title="确认解锁该商家预付款账户？"
            onConfirm={() => {
              void (async () => {
                try {
                  await api('/prepaid/unlock', {
                    method: 'POST',
                    body: JSON.stringify({ merchantId: entity.merchantId }),
                  })
                  message.success('账户已解锁')
                  void loadAll()
                } catch (cause) {
                  message.error(cause instanceof Error ? cause.message : '操作失败')
                }
              })()
            }}
          >
            <a>解锁</a>
          </Popconfirm>
        ) : (
          <a key="lock" onClick={() => setLockTarget(entity)}>
            锁定
          </a>
        ),
      ],
    },
  ]

  const rechargeColumns: ProColumns<RechargeOrder>[] = [
    { title: '充值单号', dataIndex: 'rechargeNo', width: 190, copyable: true },
    {
      title: '商家',
      width: 150,
      renderText: (_, entity: RechargeOrder) => merchantName(entity.merchant),
    },
    {
      title: '充值金额',
      dataIndex: 'amountCents',
      width: 110,
      renderText: (value: number) => formatCents(value),
    },
    {
      title: '实付金额',
      dataIndex: 'paidAmountCents',
      width: 110,
      renderText: (value?: number | null) => (value !== null && value !== undefined ? formatCents(value) : '—'),
    },
    {
      title: '付款方',
      dataIndex: 'payerName',
      width: 130,
      renderText: (value?: string | null) => value ?? '—',
    },
    {
      title: '凭证',
      dataIndex: 'voucherUrl',
      width: 140,
      ellipsis: true,
      render: (_, entity) =>
        entity.voucherUrl ? (
          <a href={entity.voucherUrl} target="_blank" rel="noreferrer">
            查看凭证
          </a>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '备注',
      dataIndex: 'note',
      width: 180,
      ellipsis: true,
      renderText: (value?: string | null) => value ?? '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_, entity) => {
        const meta = RECHARGE_STATUS_META[entity.status] ?? { label: entity.status, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 130,
      render: (_, entity) => {
        if (entity.status === 'credited' || entity.status === 'rejected') {
          return [<Text key="none" type="secondary">—</Text>]
        }
        return [
          <Popconfirm
            key="credit"
            title="确认审核通过并入账？"
            onConfirm={() => {
              void (async () => {
                try {
                  await api(`/prepaid/recharges/${entity.id}/credit`, {
                    method: 'POST',
                    body: JSON.stringify({ reviewApproved: true }),
                  })
                  message.success('充值已入账')
                  void loadAll()
                } catch (cause) {
                  message.error(cause instanceof Error ? cause.message : '操作失败')
                }
              })()
            }}
          >
            <a>入账</a>
          </Popconfirm>,
          <a key="reject" onClick={() => setRejectTarget(entity)}>
            拒绝
          </a>,
        ]
      },
    },
  ]

  return (
    <PageContainer
      header={{ title: '预付款', subTitle: '商家预付款账户与充值审核' }}
      content="管理商家预付款账户余额与冻结，审核充值入账，执行调整、锁定与解锁。"
    >
      <Tabs
        defaultActiveKey="accounts"
        items={[
          {
            key: 'accounts',
            label: '预付款账户',
            children: (
              <ProTable<PrepaidAccount>
                rowKey="id"
                columns={accountColumns}
                search={false}
                dataSource={accounts}
                loading={!loaded}
                options={{ reload: () => void loadAll(), density: true, setting: true }}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'recharges',
            label: '充值审核',
            children: (
              <ProTable<RechargeOrder>
                rowKey="id"
                columns={rechargeColumns}
                search={false}
                dataSource={recharges}
                loading={!loaded}
                options={{ reload: () => void loadAll(), density: true, setting: true }}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
        ]}
      />

      <ModalForm<{ amountYuan: number; note: string }>
        title={`调整预付款 · ${merchantName(adjustTarget?.merchant)}`}
        width={440}
        open={Boolean(adjustTarget)}
        modalProps={{ onCancel: () => setAdjustTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setAdjustTarget(null)
        }}
        onFinish={async (values) => {
          if (!adjustTarget) return false
          try {
            await api('/prepaid/adjust', {
              method: 'POST',
              body: JSON.stringify({
                merchantId: adjustTarget.merchantId,
                amountCents: Math.round(values.amountYuan * 100),
                note: values.note,
              }),
            })
            message.success('调整已完成')
            setAdjustTarget(null)
            void loadAll()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '操作失败')
            return false
          }
        }}
      >
        <ProFormDigit
          name="amountYuan"
          label="调整金额（元）"
          fieldProps={{ precision: 2 }}
          rules={[{ required: true, message: '请输入调整金额' }]}
          extra={`正数调增、负数调减，当前可用 ${adjustTarget ? formatCents(adjustTarget.availableCents) : '—'}`}
        />
        <ProFormTextArea
          name="note"
          label="调整原因"
          rules={[{ required: true, message: '请输入调整原因' }]}
        />
      </ModalForm>

      <ModalForm<{ reason?: string }>
        title={`锁定预付款账户 · ${merchantName(lockTarget?.merchant)}`}
        width={440}
        open={Boolean(lockTarget)}
        modalProps={{ onCancel: () => setLockTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setLockTarget(null)
        }}
        onFinish={async (values) => {
          if (!lockTarget) return false
          try {
            await api('/prepaid/lock', {
              method: 'POST',
              body: JSON.stringify({
                merchantId: lockTarget.merchantId,
                reason: values.reason || undefined,
              }),
            })
            message.success('账户已锁定，采购入口将不可用')
            setLockTarget(null)
            void loadAll()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '操作失败')
            return false
          }
        }}
      >
        <ProFormTextArea name="reason" label="锁定原因" placeholder="选填" />
      </ModalForm>

      <ModalForm<{ reason?: string }>
        title={`拒绝充值 · ${rejectTarget?.rechargeNo ?? ''}`}
        width={440}
        open={Boolean(rejectTarget)}
        modalProps={{ onCancel: () => setRejectTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null)
        }}
        onFinish={async (values) => {
          if (!rejectTarget) return false
          try {
            await api(`/prepaid/recharges/${rejectTarget.id}/reject`, {
              method: 'POST',
              body: JSON.stringify({ reason: values.reason || undefined }),
            })
            message.success('充值单已拒绝')
            setRejectTarget(null)
            void loadAll()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '操作失败')
            return false
          }
        }}
      >
        <ProFormTextArea name="reason" label="拒绝原因" placeholder="选填" />
      </ModalForm>
    </PageContainer>
  )
}
