import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { PageContainer } from '@ant-design/pro-components'
import { api, getToken } from '../lib/api'

const { Paragraph } = Typography

type AuditLog = {
  id: string
  actorId: string | null
  actorRole: string | null
  action: string
  resourceType: string
  resourceId: string
  orderNo: string | null
  boxCode: string | null
  customerId: string | null
  channelId: string | null
  merchantId: string | null
  detail: unknown
  createdAt: string
}

type AuditResponse = {
  items: AuditLog[]
  total: number
  page: number
  pageSize: number
}

type Filters = {
  orderNo?: string
  boxCode?: string
  customer?: string
  channelCode?: string
  resourceType?: string
  action?: string
}

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'

export default function AuditPage() {
  const [form] = Form.useForm()
  const [items, setItems] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<Filters>({})
  const [range, setRange] = useState<[string, string] | null>(null)
  const [purpose, setPurpose] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        }
      })
      if (range) {
        params.set('from', range[0])
        params.set('to', range[1])
      }
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const result = await api<AuditResponse>(`/audit?${params.toString()}`)
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filters, range, page, pageSize])

  useEffect(() => {
    void load()
  }, [load])

  const search = () => {
    const values = form.getFieldsValue()
    setFilters({
      orderNo: values.orderNo?.trim() || undefined,
      boxCode: values.boxCode?.trim() || undefined,
      customer: values.customer?.trim() || undefined,
      channelCode: values.channelCode?.trim() || undefined,
      resourceType: values.resourceType?.trim() || undefined,
      action: values.action?.trim() || undefined,
    })
    const from = values.range?.[0]?.toISOString()
    const to = values.range?.[1]?.toISOString()
    setRange(from && to ? [from, to] : null)
    setPage(1)
  }

  const reset = () => {
    form.resetFields()
    setFilters({})
    setRange(null)
    setPage(1)
  }

  const exportPackage = async () => {
    if (purpose.trim().length < 2) {
      message.warning('请填写导出用途')
      return
    }
    setExporting(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        }
      })
      if (range) {
        params.set('from', range[0])
        params.set('to', range[1])
      }
      params.set('purpose', purpose.trim())
      params.set('format', exportFormat)
      const response = await fetch(`/api/audit/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message ?? `导出失败（${response.status}）`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `audit-package.${exportFormat === 'pdf' ? 'pdf' : 'xlsx'}`
      anchor.click()
      URL.revokeObjectURL(url)
      message.success('凭证包已导出，导出用途已留痕')
      setExportOpen(false)
      setPurpose('')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <PageContainer
      header={{ title: '合规留痕', subTitle: '审计日志与凭证包导出' }}
      content="只追加留痕，支持按订单号、盒码、客户、渠道与时间检索，并导出 PDF 汇总 + Excel 明细凭证包。"
    >
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={() => search()}>
          <Form.Item name="orderNo" label="订单号">
            <Input allowClear placeholder="SO..." />
          </Form.Item>
          <Form.Item name="boxCode" label="盒码">
            <Input allowClear placeholder="BX..." />
          </Form.Item>
          <Form.Item name="customer" label="客户">
            <Input allowClear placeholder="手机号或用户 ID" />
          </Form.Item>
          <Form.Item name="channelCode" label="渠道码">
            <Input allowClear placeholder="M..." />
          </Form.Item>
          <Form.Item name="resourceType" label="资源类型">
            <Input allowClear placeholder="order / report" />
          </Form.Item>
          <Form.Item name="action" label="动作">
            <Input allowClear placeholder="order.pay" />
          </Form.Item>
          <Form.Item name="range" label="时间">
            <DatePicker.RangePicker showTime />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                检索
              </Button>
              <Button onClick={reset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title={`检索结果（${total} 条）`}
        extra={
          <Space>
            <Button
              onClick={() => {
                setExportFormat('excel')
                setExportOpen(true)
              }}
            >
              导出 Excel 明细
            </Button>
            <Button
              onClick={() => {
                setExportFormat('pdf')
                setExportOpen(true)
              }}
            >
              导出 PDF 汇总
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          locale={{ emptyText: '暂无留痕记录' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage)
              setPageSize(nextPageSize)
            },
          }}
          expandable={{
            expandedRowRender: (record) => (
              <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered>
                <Descriptions.Item label="资源">
                  {record.resourceType} / {record.resourceId}
                </Descriptions.Item>
                <Descriptions.Item label="操作人">
                  {record.actorRole ?? 'system'} · {record.actorId ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="订单号">{record.orderNo ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="盒码">{record.boxCode ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="客户">{record.customerId ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="渠道/商家">
                  {record.channelId ?? '—'} / {record.merchantId ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="详情" span={2}>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      background: 'var(--ant-color-bg-layout)',
                      padding: 8,
                      borderRadius: 6,
                    }}
                  >
                    {JSON.stringify(record.detail, null, 2)}
                  </pre>
                </Descriptions.Item>
              </Descriptions>
            ),
          }}
          columns={[
            {
              title: '时间',
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => formatDateTime(value),
            },
            {
              title: '动作',
              dataIndex: 'action',
              width: 200,
              render: (value: string) => <Tag color="blue">{value}</Tag>,
            },
            { title: '资源类型', dataIndex: 'resourceType', width: 130 },
            {
              title: '订单号',
              dataIndex: 'orderNo',
              width: 180,
              render: (value: string | null) => value ?? '—',
            },
            {
              title: '盒码',
              dataIndex: 'boxCode',
              width: 180,
              render: (value: string | null) => value ?? '—',
            },
            { title: '客户', dataIndex: 'customerId', ellipsis: true },
            {
              title: '角色',
              dataIndex: 'actorRole',
              width: 110,
              render: (value: string | null) => value ?? 'system',
            },
          ]}
        />
      </Card>

      <Modal
        title={`导出 ${exportFormat === 'pdf' ? 'PDF 汇总' : 'Excel 明细'}凭证包`}
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        onOk={() => void exportPackage()}
        confirmLoading={exporting}
        okText="导出并留痕"
      >
        <Paragraph type="secondary">
          导出行为会记录导出人、时间、筛选条件与用途。请填写本次导出的合规用途。
        </Paragraph>
        <Input
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          placeholder="例如：客户投诉核查 / 季度合规抽检"
          maxLength={100}
        />
      </Modal>
    </PageContainer>
  )
}
