import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Input, Space, Table, Tag, Typography, message } from 'antd'
import { api } from '../lib/api'

const { Title, Paragraph } = Typography

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

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [status, setStatus] = useState('open')
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) {
        params.set('status', status)
      }
      if (type.trim()) {
        params.set('type', type.trim())
      }
      setAlerts(await api<Alert[]>(`/alerts?${params.toString()}`))
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [status, type])

  useEffect(() => {
    void load()
  }, [load])

  const resolve = async (id: string) => {
    try {
      await api(`/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({}) })
      void message.success('告警已处理')
      await load()
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '处理失败')
    }
  }

  return (
    <div>
      <Title level={4} style={{ margin: 0 }}>
        风控告警
      </Title>
      <Paragraph type="secondary">
        覆盖自购、层级异常、盒码异常、异常注册、高频退款、预付款异常、报告外传与培训作弊。
      </Paragraph>

      <Card
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <Input
              value={type}
              onChange={(event) => setType(event.target.value)}
              placeholder="告警类型，如 box_code_multi_scan"
              style={{ width: 320 }}
              allowClear
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d9d9d9' }}
            >
              <option value="open">待处理</option>
              <option value="resolved">已处理</option>
              <option value="">全部</option>
            </select>
            <Button type="primary" onClick={() => void load()}>
              检索
            </Button>
          </Space>
        }
      >
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={alerts}
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: '时间',
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => new Date(value).toLocaleString('zh-CN'),
            },
            {
              title: '级别',
              dataIndex: 'severity',
              width: 100,
              render: (value: string) => (
                <Tag color={SEVERITY_COLORS[value] ?? 'default'}>{value}</Tag>
              ),
            },
            {
              title: '类型',
              dataIndex: 'type',
              width: 240,
              render: (value: string) => <Tag color="blue">{value}</Tag>,
            },
            { title: '告警内容', dataIndex: 'message' },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (value: string) =>
                value === 'open' ? <Tag color="red">待处理</Tag> : <Tag color="green">已处理</Tag>,
            },
            {
              title: '操作',
              width: 100,
              render: (_, alert) =>
                alert.status === 'open' ? (
                  <Button size="small" onClick={() => void resolve(alert.id)}>
                    处理
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>
    </div>
  )
}
