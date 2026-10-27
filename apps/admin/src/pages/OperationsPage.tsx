import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Empty, Space, Table, Tag, message } from 'antd'
import { PageContainer } from '@ant-design/pro-components'
import { api } from '../lib/api'

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

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('zh-CN', { hour12: false })

export default function OperationsPage() {
  const [groups, setGroups] = useState<MerchantTaskGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setGroups(await api<MerchantTaskGroup[]>('/notifications/report-tasks'))
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const scan = async () => {
    setScanning(true)
    try {
      const result = await api<{ scanned: number; alertsCreated: number }>(
        '/notifications/report-tasks/scan',
        { method: 'POST', body: JSON.stringify({}) },
      )
      message.success(`扫描 ${result.scanned} 条，新增告警 ${result.alertsCreated} 条`)
      await load()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '扫描失败')
    } finally {
      setScanning(false)
    }
  }

  return (
    <PageContainer
      header={{
        title: '报告待转发',
        subTitle: '商家报告转发跟进',
        extra: [
          <Button key="refresh" onClick={() => void load()}>
            刷新
          </Button>,
          <Button key="scan" type="primary" loading={scanning} onClick={() => void scan()}>
            扫描超时
          </Button>,
        ],
      }}
      content="按商家归集待转发报告，超过 24 小时未转发自动标红并提醒运营。"
    >
      {groups.length === 0 ? (
        <Card loading={loading}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待转发报告" />
        </Card>
      ) : (
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          {groups.map((group) => (
            <Card
              key={group.merchantId}
              title={group.merchantName}
              extra={
                <Space size={8}>
                  <Tag color="blue">待转发 {group.pendingCount}</Tag>
                  <Tag color={group.overdueCount > 0 ? 'red' : 'default'}>
                    超时 {group.overdueCount}
                  </Tag>
                </Space>
              }
            >
              <Table
                size="small"
                rowKey="reportId"
                loading={loading}
                pagination={false}
                scroll={{ x: 'max-content' }}
                dataSource={group.tasks}
                rowClassName={(task) => (task.overdue ? 'overdue-row' : '')}
                columns={[
                  { title: '报告号', dataIndex: 'reportNo', width: 240 },
                  {
                    title: '截止时间',
                    dataIndex: 'dueAt',
                    width: 200,
                    render: (value: string) => formatDateTime(value),
                  },
                  {
                    title: '状态',
                    dataIndex: 'overdue',
                    width: 110,
                    render: (_: unknown, task: Task) =>
                      task.overdue ? <Tag color="red">已超时</Tag> : <Tag color="green">跟进中</Tag>,
                  },
                  { title: '客户', dataIndex: 'customerId', ellipsis: true },
                ]}
              />
            </Card>
          ))}
        </Space>
      )}
    </PageContainer>
  )
}
