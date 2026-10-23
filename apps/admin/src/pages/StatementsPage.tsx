import { useEffect, useRef, useState } from 'react'
import { Button, Card, Col, Descriptions, Drawer, Popconfirm, Row, Space, Statistic, Tag, Typography, message } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import {
  ModalForm,
  PageContainer,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components'
import { formatCents } from '@mall/shared'
import { api, getToken } from '../lib/api'

const { Text } = Typography

type StatementLine = {
  id: string
  sourceType: string
  sourceId: string
  description: string
  baseAmountCents: number
  rateBps?: number | null
  level?: number | null
  ruleVersion?: string | null
  amountCents: number
  createdAt: string
}

type StatementVoucher = {
  id: string
  voucherNo: string
  title: string
  taxNo?: string | null
  amountCents: number
  issuedAt: string
  imageUrl?: string | null
  registeredBy: string
  createdAt: string
}

type StatementDifference = {
  id: string
  amountCents: number
  reason: string
  resolution?: string | null
  status: string
  createdBy: string
  createdAt: string
}

type Statement = {
  id: string
  statementNo: string
  period: string
  subjectType: string
  subjectId: string
  status: string
  openingUnsettledCents: number
  newPayableCents: number
  adjustmentCents: number
  totalPayableCents: number
  voucherRegisteredCents: number
  voucherMissingCents: number
  differenceCents: number
  generatedAt: string
  reconciledAt?: string | null
  settledAt?: string | null
  reopenedAt?: string | null
  lines: StatementLine[]
  vouchers: StatementVoucher[]
  differences: StatementDifference[]
}

type Overview = {
  totalPayableCents: number
  pendingCount: number
  disputedCount: number
  missingVoucherCents: number
  differenceCents: number
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '待对账', color: 'gold' },
  reconciling: { label: '对账中', color: 'blue' },
  reconciled: { label: '已对账', color: 'cyan' },
  settled: { label: '已结清', color: 'green' },
  disputed: { label: '有差异', color: 'red' },
}

const SUBJECT_TYPE_LABELS: Record<string, string> = {
  supplier: '供应商',
  merchant: '商家',
  partner: '合伙人',
}

const LINE_SOURCE_LABELS: Record<string, string> = {
  commission: '佣金',
  refund_adjustment: '退款冲回',
  manual_adjustment: '手工调整',
  order_settlement: '商家结算',
  procurement_order: '采购单',
}

export default function StatementsPage() {
  const actionRef = useRef<ActionType>()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [detail, setDetail] = useState<Statement | null>(null)
  const [voucherOpen, setVoucherOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [differenceOpen, setDifferenceOpen] = useState(false)
  const [resolveTarget, setResolveTarget] = useState<StatementDifference | null>(null)

  const reload = () => actionRef.current?.reload()

  const refreshOverview = async () => {
    try {
      setOverview(await api<Overview>('/statements/overview'))
    } catch {
      setOverview(null)
    }
  }

  useEffect(() => {
    void refreshOverview()
  }, [])

  const refreshDetail = async (id: string) => {
    try {
      setDetail(await api<Statement>(`/statements/${id}`))
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '刷新详情失败')
    }
  }

  const openDetail = async (id: string) => {
    setDetail(null)
    await refreshDetail(id)
  }

  const runStatementAction = async (
    action: () => Promise<unknown>,
    successText: string,
    id?: string,
  ) => {
    try {
      await action()
      message.success(successText)
      reload()
      void refreshOverview()
      if (id) await refreshDetail(id)
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  const simpleStatementAction = (id: string, path: string, successText: string) => () =>
    runStatementAction(() => api(`/statements/${id}/${path}`, { method: 'POST' }), successText, id)

  const downloadExport = async (id: string, format: 'xlsx' | 'pdf') => {
    try {
      const token = getToken()
      const response = await fetch(`/api/statements/${id}/export?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) {
        throw new Error(`导出失败（${response.status}）`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `statement-${id}.${format}`
      link.click()
      URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '导出失败')
    }
  }

  const columns: ProColumns<Statement>[] = [
    { title: '对账单号', dataIndex: 'statementNo', width: 190, copyable: true },
    { title: '周期', dataIndex: 'period', width: 90 },
    {
      title: '主体',
      width: 170,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>
            {SUBJECT_TYPE_LABELS[entity.subjectType] ?? entity.subjectType}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }} copyable={{ text: entity.subjectId }}>
            {entity.subjectId.slice(0, 16)}…
          </Text>
        </Space>
      ),
    },
    {
      title: '本期应付',
      dataIndex: 'totalPayableCents',
      width: 120,
      renderText: (value: number) => formatCents(value),
    },
    {
      title: '已登记票证',
      dataIndex: 'voucherRegisteredCents',
      width: 120,
      renderText: (value: number) => formatCents(value),
    },
    {
      title: '未取得票证',
      dataIndex: 'voucherMissingCents',
      width: 120,
      renderText: (value: number) => (value > 0 ? formatCents(value) : '—'),
    },
    {
      title: '差异',
      dataIndex: 'differenceCents',
      width: 110,
      renderText: (value: number) => (value !== 0 ? formatCents(value) : '—'),
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
      title: '操作',
      valueType: 'option',
      width: 90,
      render: (_, entity) => [
        <a key="detail" onClick={() => void openDetail(entity.id)}>
          详情
        </a>,
      ],
    },
  ]

  const settled = detail?.status === 'settled'

  return (
    <PageContainer
      header={{ title: '对账中心', subTitle: '对账、票证、差异与结算' }}
      content="按周期生成主体对账单，登记票证与调整，处理差异并完成结算，支持导出 Excel / PDF。"
    >
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="应付总额"
              value={overview ? formatCents(overview.totalPayableCents) : '—'}
              valueStyle={{ fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="未取得票证"
              value={overview ? formatCents(overview.missingVoucherCents) : '—'}
              valueStyle={{ fontSize: 20, color: (overview?.missingVoucherCents ?? 0) > 0 ? '#d46b08' : undefined }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="差异金额"
              value={overview ? formatCents(overview.differenceCents) : '—'}
              valueStyle={{ fontSize: 20, color: (overview?.differenceCents ?? 0) > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="待对账" value={overview?.pendingCount ?? 0} suffix="单" valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="有差异"
              value={overview?.disputedCount ?? 0}
              suffix="单"
              valueStyle={{ fontSize: 20, color: (overview?.disputedCount ?? 0) > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <ProTable<Statement>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        headerTitle={
          <ModalForm<{
            period: string
            subjectType: 'supplier' | 'merchant' | 'partner'
            subjectId: string
          }>
            title="生成对账单"
            width={460}
            trigger={<Button type="primary">生成对账单</Button>}
            onFinish={async (values) => {
              try {
                const created = await api<Statement>('/statements/generate', {
                  method: 'POST',
                  body: JSON.stringify({
                    period: values.period,
                    subjectType: values.subjectType,
                    subjectId: values.subjectId.trim(),
                  }),
                })
                message.success(`对账单 ${created.statementNo} 已生成`)
                reload()
                void refreshOverview()
                return true
              } catch (cause) {
                message.error(cause instanceof Error ? cause.message : '操作失败')
                return false
              }
            }}
          >
            <ProFormDatePicker
              name="period"
              label="对账周期"
              rules={[{ required: true, message: '请选择对账周期' }]}
              fieldProps={{ picker: 'month', format: 'YYYY-MM' }}
            />
            <ProFormSelect
              name="subjectType"
              label="主体类型"
              options={[
                { label: '供应商', value: 'supplier' },
                { label: '商家', value: 'merchant' },
                { label: '合伙人', value: 'partner' },
              ]}
              rules={[{ required: true, message: '请选择主体类型' }]}
            />
            <ProFormText
              name="subjectId"
              label="主体 ID"
              rules={[{ required: true, message: '请输入主体用户 ID' }]}
            />
          </ModalForm>
        }
        options={{ reload: true, density: true, setting: true }}
        pagination={{ pageSize: 10 }}
        request={async () => {
          const data = await api<Statement[]>('/statements')
          return { data, success: true }
        }}
      />

      <Drawer
        width={760}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `对账单 ${detail.statementNo}` : '对账单详情'}
      >
        {detail ? (
          <Space direction="vertical" size={16} style={{ display: 'flex' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_META[detail.status]?.color ?? 'default'}>
                  {STATUS_META[detail.status]?.label ?? detail.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="周期">{detail.period}</Descriptions.Item>
              <Descriptions.Item label="主体">
                {SUBJECT_TYPE_LABELS[detail.subjectType] ?? detail.subjectType}
              </Descriptions.Item>
              <Descriptions.Item label="主体 ID">
                <Text copyable style={{ fontSize: 12 }}>
                  {detail.subjectId}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="上期未结清">{formatCents(detail.openingUnsettledCents)}</Descriptions.Item>
              <Descriptions.Item label="本期新增应付">{formatCents(detail.newPayableCents)}</Descriptions.Item>
              <Descriptions.Item label="调整项">{formatCents(detail.adjustmentCents)}</Descriptions.Item>
              <Descriptions.Item label="本期应付合计">
                <Text strong>{formatCents(detail.totalPayableCents)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="已登记票证">{formatCents(detail.voucherRegisteredCents)}</Descriptions.Item>
              <Descriptions.Item label="未取得票证">{formatCents(detail.voucherMissingCents)}</Descriptions.Item>
            </Descriptions>

            <Space wrap>
              <Button type="primary" disabled={settled} onClick={() => setVoucherOpen(true)}>
                登记凭证
              </Button>
              <Button disabled={settled} onClick={() => setAdjustOpen(true)}>
                调整金额
              </Button>
              <Button danger onClick={() => setDifferenceOpen(true)}>
                登记差异
              </Button>
              <Popconfirm
                title="确认完成对账？"
                disabled={settled}
                onConfirm={() => simpleStatementAction(detail.id, 'reconcile', '已标记为已对账')()}
              >
                <Button disabled={settled}>对账</Button>
              </Popconfirm>
              <Popconfirm
                title="确认结清该账单？"
                disabled={detail.status !== 'reconciled'}
                onConfirm={() => simpleStatementAction(detail.id, 'settle', '已结清')()}
              >
                <Button type="primary" ghost disabled={detail.status !== 'reconciled'}>
                  结算
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认反结清（重开）该账单？"
                disabled={!settled}
                onConfirm={() => simpleStatementAction(detail.id, 'reopen', '已重开')()}
              >
                <Button disabled={!settled}>重开</Button>
              </Popconfirm>
              <Button onClick={() => void downloadExport(detail.id, 'xlsx')}>导出 Excel</Button>
              <Button onClick={() => void downloadExport(detail.id, 'pdf')}>导出 PDF</Button>
            </Space>

            <Text strong>账单明细</Text>
            <ProTable<StatementLine>
              rowKey="id"
              size="small"
              search={false}
              options={false}
              pagination={false}
              columns={[
                {
                  title: '来源',
                  dataIndex: 'sourceType',
                  width: 100,
                  renderText: (value: string) => LINE_SOURCE_LABELS[value] ?? value,
                },
                { title: '说明', dataIndex: 'description', ellipsis: true },
                {
                  title: '基数',
                  dataIndex: 'baseAmountCents',
                  width: 100,
                  renderText: (value: number) => formatCents(value),
                },
                {
                  title: '金额',
                  dataIndex: 'amountCents',
                  width: 110,
                  renderText: (value: number) => formatCents(value),
                },
              ]}
              dataSource={detail.lines}
            />

            <Text strong>凭证（{detail.vouchers.length}）</Text>
            {detail.vouchers.length ? (
              <ProTable<StatementVoucher>
                rowKey="id"
                size="small"
                search={false}
                options={false}
                pagination={false}
                columns={[
                  { title: '凭证号', dataIndex: 'voucherNo', copyable: true },
                  { title: '标题', dataIndex: 'title', ellipsis: true },
                  { title: '税号', dataIndex: 'taxNo', renderText: (v?: string | null) => v ?? '—' },
                  {
                    title: '金额',
                    dataIndex: 'amountCents',
                    width: 110,
                    renderText: (value: number) => formatCents(value),
                  },
                  {
                    title: '开票日期',
                    dataIndex: 'issuedAt',
                    width: 110,
                    renderText: (value: string) => value.slice(0, 10),
                  },
                ]}
                dataSource={detail.vouchers}
              />
            ) : (
              <Text type="secondary">暂无凭证</Text>
            )}

            <Text strong>差异（{detail.differences.length}）</Text>
            {detail.differences.length ? (
              <ProTable<StatementDifference>
                rowKey="id"
                size="small"
                search={false}
                options={false}
                pagination={false}
                columns={[
                  {
                    title: '金额',
                    dataIndex: 'amountCents',
                    width: 110,
                    renderText: (value: number) => formatCents(value),
                  },
                  { title: '原因', dataIndex: 'reason', ellipsis: true },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 90,
                    render: (_, entity) =>
                      entity.status === 'resolved' ? (
                        <Tag color="green">已解决</Tag>
                      ) : (
                        <Tag color="red">待处理</Tag>
                      ),
                  },
                  {
                    title: '处理结论',
                    dataIndex: 'resolution',
                    ellipsis: true,
                    renderText: (value?: string | null) => value ?? '—',
                  },
                  {
                    title: '操作',
                    valueType: 'option',
                    width: 80,
                    render: (_, entity) =>
                      entity.status === 'open'
                        ? [
                            <a key="resolve" onClick={() => setResolveTarget(entity)}>
                              解决
                            </a>,
                          ]
                        : [<Text key="done" type="secondary">—</Text>],
                  },
                ]}
                dataSource={detail.differences}
              />
            ) : (
              <Text type="secondary">暂无差异</Text>
            )}
          </Space>
        ) : null}
      </Drawer>

      {detail ? (
        <>
          <ModalForm<{
            voucherNo: string
            title: string
            taxNo?: string
            amountYuan: number
            issuedAt: string
            imageUrl?: string
          }>
            title={`登记凭证 · ${detail.statementNo}`}
            width={520}
            open={voucherOpen}
            modalProps={{ onCancel: () => setVoucherOpen(false) }}
            onOpenChange={setVoucherOpen}
            onFinish={async (values) => {
              try {
                await api(`/statements/${detail.id}/vouchers`, {
                  method: 'POST',
                  body: JSON.stringify({
                    voucherNo: values.voucherNo.trim(),
                    title: values.title.trim(),
                    taxNo: values.taxNo || undefined,
                    amountCents: Math.round(values.amountYuan * 100),
                    issuedAt: new Date(values.issuedAt).toISOString(),
                    imageUrl: values.imageUrl || undefined,
                  }),
                })
                message.success('凭证已登记')
                setVoucherOpen(false)
                reload()
                void refreshOverview()
                await refreshDetail(detail.id)
                return true
              } catch (cause) {
                message.error(cause instanceof Error ? cause.message : '操作失败')
                return false
              }
            }}
          >
            <ProFormText
              name="voucherNo"
              label="凭证号"
              rules={[{ required: true, message: '请输入凭证号' }]}
            />
            <ProFormText
              name="title"
              label="凭证标题"
              rules={[{ required: true, message: '请输入凭证标题' }]}
            />
            <ProFormText name="taxNo" label="税号" placeholder="选填" />
            <ProFormDigit
              name="amountYuan"
              label="凭证金额（元）"
              min={0.01}
              fieldProps={{ precision: 2 }}
              rules={[{ required: true, message: '请输入凭证金额' }]}
              extra={`剩余未取得票证 ${formatCents(detail.voucherMissingCents)}`}
            />
            <ProFormDatePicker
              name="issuedAt"
              label="开票日期"
              rules={[{ required: true, message: '请选择开票日期' }]}
              fieldProps={{ format: 'YYYY-MM-DD' }}
            />
            <ProFormText name="imageUrl" label="凭证图片地址" placeholder="选填" />
          </ModalForm>

          <ModalForm<{ amountYuan: number; reason: string }>
            title={`调整金额 · ${detail.statementNo}`}
            width={440}
            open={adjustOpen}
            modalProps={{ onCancel: () => setAdjustOpen(false) }}
            onOpenChange={setAdjustOpen}
            onFinish={async (values) => {
              try {
                await api(`/statements/${detail.id}/adjustments`, {
                  method: 'POST',
                  body: JSON.stringify({
                    amountCents: Math.round(values.amountYuan * 100),
                    reason: values.reason,
                  }),
                })
                message.success('调整已登记')
                setAdjustOpen(false)
                reload()
                void refreshOverview()
                await refreshDetail(detail.id)
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
              extra="正数调增应付，负数调减应付"
            />
            <ProFormTextArea
              name="reason"
              label="调整原因"
              rules={[{ required: true, message: '请输入调整原因' }]}
            />
          </ModalForm>

          <ModalForm<{ amountYuan: number; reason: string }>
            title={`登记差异 · ${detail.statementNo}`}
            width={440}
            open={differenceOpen}
            modalProps={{ onCancel: () => setDifferenceOpen(false) }}
            onOpenChange={setDifferenceOpen}
            onFinish={async (values) => {
              try {
                await api(`/statements/${detail.id}/differences`, {
                  method: 'POST',
                  body: JSON.stringify({
                    amountCents: Math.round(values.amountYuan * 100),
                    reason: values.reason,
                  }),
                })
                message.success('差异已登记，账单转为有差异')
                setDifferenceOpen(false)
                reload()
                void refreshOverview()
                await refreshDetail(detail.id)
                return true
              } catch (cause) {
                message.error(cause instanceof Error ? cause.message : '操作失败')
                return false
              }
            }}
          >
            <ProFormDigit
              name="amountYuan"
              label="差异金额（元）"
              fieldProps={{ precision: 2 }}
              rules={[{ required: true, message: '请输入差异金额' }]}
            />
            <ProFormTextArea
              name="reason"
              label="差异原因"
              rules={[{ required: true, message: '请输入差异原因' }]}
            />
          </ModalForm>

          <ModalForm<{ resolution: string }>
            title="解决差异"
            width={440}
            open={Boolean(resolveTarget)}
            modalProps={{ onCancel: () => setResolveTarget(null) }}
            onOpenChange={(open) => {
              if (!open) setResolveTarget(null)
            }}
            onFinish={async (values) => {
              if (!resolveTarget) return false
              try {
                await api(`/statements/${detail.id}/differences/${resolveTarget.id}/resolve`, {
                  method: 'POST',
                  body: JSON.stringify({ resolution: values.resolution }),
                })
                message.success('差异已解决')
                setResolveTarget(null)
                reload()
                void refreshOverview()
                await refreshDetail(detail.id)
                return true
              } catch (cause) {
                message.error(cause instanceof Error ? cause.message : '操作失败')
                return false
              }
            }}
          >
            <ProFormTextArea
              name="resolution"
              label="处理结论"
              rules={[{ required: true, message: '请输入处理结论' }]}
              extra={resolveTarget ? `差异金额 ${formatCents(resolveTarget.amountCents)} · ${resolveTarget.reason}` : undefined}
            />
          </ModalForm>
        </>
      ) : null}
    </PageContainer>
  )
}
