import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Space, Table, Tag, Typography, message } from 'antd'
import { api } from '../lib/api'

const { Title, Paragraph } = Typography

type Task = {
  reportId: string
  reportNo: string
  orderId: string | null
  customerId: string
  dueAt: string
  overdue: boolean
}

type MerchantTaskGroup = {
  merchantId: string
  merchantName: string
  pendingCount: number
  overdueCount: number
  tasks: Task[]
}

export default function OperationsPage() {
  const [groups, setGroups] = useState<MerchantTaskGroup[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setGroups(await api<MerchantTaskGroup[]>('/notifications/report-tasks'))
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const scan = async () => {
    try {
      const result = await api<{ scanned: number; alertsCreated: number }>(
        '/notifications/report-tasks/scan',
        { method: 'POST', body: JSON.stringify({}) },
      )
      void message.success(`扫描 ${result.scanned} 条，新增告警 ${result.alertsCreated} 条`)
      await load()
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '扫描失败')
    }
  }

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            报告待转发
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            按商家归集，超过 24 小时未转发自动标红并提醒运营。
          </Paragraph>
        </div>
        <Space>
          <Button onClick={() => void load()}>刷新</Button>
          <Button type="primary" onClick={() => void scan()}>
            扫描超时
          </Button>
        </Space>
      </Space>

      {groups.length === 0 ? (
        <Card loading={loading}>暂无待转发报告</Card>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {groups.map((group) => (
            <Card
              key={group.merchantId}
              title={group.merchantName}
              extra={
                <Space>
                  <Tag>待转发 {group.pendingCount}</Tag>
                  <Tag color={group.overdueCount > 0 ? 'red' : 'default'}>
                    超时 {group.overdueCount}
                  </Tag>
                </Space>
              }
            >
              <Table
                size="small"
                rowKey="reportId"
                pagination={false}
                dataSource={group.tasks}
                rowClassName={(task) => (task.overdue ? 'overdue-row' : '')}
                columns={[
                  { title: '报告号', dataIndex: 'reportNo' },
                  {
                    title: '截止时间',
                    dataIndex: 'dueAt',
                    render: (value: string, task) => (
                      <Tag color={task.overdue ? 'red' : 'blue'}>
                        {new Date(value).toLocaleString('zh-CN')}
                      </Tag>
                    ),
                  },
                  {
                    title: '状态',
                    dataIndex: 'overdue',
                    render: (overdue: boolean) =>
                      overdue ? <Tag color="red">已超时</Tag> : <Tag color="green">跟进中</Tag>,
                  },
                  { title: '客户', dataIndex: 'customerId', ellipsis: true },
                ]}
              />
            </Card>
          ))}
        </Space>
      )}
    </div>
  )
}
