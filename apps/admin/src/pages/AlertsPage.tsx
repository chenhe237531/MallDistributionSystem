import { useRef, useState } from 'react'
import { Button, Input, Select, Space, Tag, message } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import { api } from '../lib/api'

type Alert = {
  id: string
  type: string
  subjectType: string
  subjectId: string
  message: string
  severity: string
  status: string
  createdAt: string
  resolvedAt: string | null
}

const SEVERITY_META: Record<string, { label: string; color: string }> = {
  critical: { label: '严重', color: 'red' },
  warning: { label: '警告', color: 'orange' },
  info: { label: '提示', color: 'blue' },
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: '待处理', color: 'red' },
  resolved: { label: '已处理', color: 'green' },
}

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'

const STATUS_OPTIONS = [
  { value: 'open', label: '待处理' },
  { value: 'resolved', label: '已处理' },
  { value: '', label: '全部' },
]

export default function AlertsPage() {
  const actionRef = useRef<ActionType>()
  const [statusInput, setStatusInput] = useState('open')
  const [typeInput, setTypeInput] = useState('')
  const [filters, setFilters] = useState<{ status: string; type: string }>({
    status: 'open',
    type: '',
  })

  const applyFilters = () => setFilters({ status: statusInput, type: typeInput.trim() })

  const resolve = async (id: string) => {
    try {
      await api(`/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({}) })
      message.success('告警已处理')
      actionRef.current?.reload()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '处理失败')
    }
  }

  const columns: ProColumns<Alert>[] = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 180,
      renderText: (value: string) => formatDateTime(value),
    },
    {
      title: '级别',
      dataIndex: 'severity',
      width: 90,
      render: (_, entity) => {
        const meta = SEVERITY_META[entity.severity] ?? {
          label: entity.severity,
          color: 'default',
        }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 220,
      render: (_, entity) => <Tag color="blue">{entity.type}</Tag>,
    },
    { title: '告警内容', dataIndex: 'message', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, entity) => {
        const meta = STATUS_META[entity.status] ?? { label: entity.status, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 90,
      render: (_, entity) =>
        entity.status === 'open' ? (
          <a key="resolve" onClick={() => void resolve(entity.id)}>
            处理
          </a>
        ) : (
          [<span key="none">—</span>]
        ),
    },
  ]

  return (
    <PageContainer
      header={{ title: '风控告警', subTitle: '告警检索与处理' }}
      content="覆盖自购、层级异常、盒码异常、异常注册、高频退款、预付款异常、报告外传与培训作弊。"
    >
      <ProTable<Alert>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        options={{ reload: true, density: true, setting: true }}
        params={{ status: filters.status, type: filters.type }}
        pagination={{ pageSize: 20 }}
        headerTitle={
          <Space wrap>
            <Input
              value={typeInput}
              onChange={(event) => setTypeInput(event.target.value)}
              onPressEnter={applyFilters}
              placeholder="告警类型，如 box_code_multi_scan"
              allowClear
              style={{ width: 260 }}
            />
            <Select
              value={statusInput}
              onChange={setStatusInput}
              options={STATUS_OPTIONS}
              style={{ width: 120 }}
            />
            <Button type="primary" onClick={applyFilters}>
              检索
            </Button>
          </Space>
        }
        request={async (params) => {
          try {
            const search = new URLSearchParams()
            if (params.status) {
              search.set('status', params.status)
            }
            const type = (params.type ?? '').trim()
            if (type) {
              search.set('type', type)
            }
            const data = await api<Alert[]>(`/alerts?${search.toString()}`)
            return { data, success: true }
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '加载失败')
            return { data: [], success: false }
          }
        }}
      />
    </PageContainer>
  )
}
