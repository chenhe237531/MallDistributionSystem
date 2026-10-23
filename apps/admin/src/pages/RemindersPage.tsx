import { useRef, useState } from 'react'
import { Button, Space, Tag, Typography, message } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import { api } from '../lib/api'

const { Text } = Typography

type ReminderUser = { id: string; name: string; phone: string; roles: string[] }

type Qualification = {
  id: string
  type: string
  status: string
  expiresAt?: string | null
  user?: ReminderUser | null
}

type Reminder = {
  id: string
  type: string
  subjectId: string
  dueAt: string
  status: string
  qualificationId?: string | null
  qualification?: Qualification | null
  createdAt: string
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  qualification_expiry: { label: '资质到期', color: 'orange' },
  contract_expiry: { label: '合同到期', color: 'geekblue' },
  training_expiry: { label: '培训到期', color: 'cyan' },
}

const DAY_MS = 24 * 60 * 60 * 1000

export default function RemindersPage() {
  const actionRef = useRef<ActionType>()
  const [scanning, setScanning] = useState(false)

  const reload = () => actionRef.current?.reload()

  const scan = async () => {
    setScanning(true)
    try {
      const result = await api<{ created: number }>('/reminders/scan', { method: 'POST' })
      message.success(`扫描完成，覆盖 ${result.created} 条临期对象`)
      reload()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '扫描失败')
    } finally {
      setScanning(false)
    }
  }

  const columns: ProColumns<Reminder>[] = [
    {
      title: '提醒类型',
      dataIndex: 'type',
      width: 110,
      render: (_, entity) => {
        const meta = TYPE_META[entity.type] ?? { label: entity.type, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '关联对象',
      width: 200,
      render: (_, entity) => {
        if (entity.qualification?.user) {
          return (
            <Space direction="vertical" size={0}>
              <Text strong>{entity.qualification.user.name}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {entity.qualification.user.phone} · 资质：{entity.qualification.type}
              </Text>
            </Space>
          )
        }
        return (
          <Text type="secondary" style={{ fontSize: 12 }} copyable>
            {entity.subjectId}
          </Text>
        )
      },
    },
    {
      title: '到期时间',
      dataIndex: 'dueAt',
      width: 150,
      render: (_, entity) => {
        const days = Math.ceil((new Date(entity.dueAt).getTime() - Date.now()) / DAY_MS)
        const urgent = days <= 7
        return (
          <Space direction="vertical" size={0}>
            <Text style={urgent ? { color: '#cf1322' } : undefined}>
              {entity.dueAt.slice(0, 10)}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {days < 0 ? `已过期 ${-days} 天` : `剩余 ${days} 天`}
            </Text>
          </Space>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, entity) =>
        entity.status === 'pending' ? (
          <Tag color="gold">待处理</Tag>
        ) : (
          <Tag>{entity.status}</Tag>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 110,
      renderText: (value: string) => value.slice(0, 10),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 80,
      render: () => [
        <a key="rescan" onClick={() => void scan()}>
          重新扫描
        </a>,
      ],
    },
  ]

  return (
    <PageContainer
      header={{ title: '超时提醒', subTitle: '资质、合同与培训临期提醒' }}
      content="扫描 30 天内即将到期的资质、合同与培训证书并生成提醒；每日凌晨自动扫描，也可手动触发。"
    >
      <ProTable<Reminder>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        options={{ reload: true, density: true, setting: true }}
        pagination={{ pageSize: 10 }}
        toolBarRender={() => [
          <Button key="scan" type="primary" loading={scanning} onClick={() => void scan()}>
            触发扫描
          </Button>,
        ]}
        request={async () => {
          const data = await api<Reminder[]>('/reminders')
          return { data, success: true }
        }}
      />
    </PageContainer>
  )
}
