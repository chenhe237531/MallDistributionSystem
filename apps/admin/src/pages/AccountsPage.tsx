import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { ROLE_LABELS, Role } from '@mall/shared'
import { api } from '../lib/api'

const { Title, Paragraph } = Typography

type Channel = { id: string; code: string; type: string; status: string }
type Qualification = { id: string; type: string; status: string; expiresAt?: string }
type Account = {
  id: string
  name: string
  phone: string
  roles: Role[]
  primaryRole: Role
  status: string
  organization?: { id: string; name: string; status: string } | null
  channels: Channel[]
  qualifications: Qualification[]
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'gold',
  active: 'green',
  suspended: 'red',
  rejected: 'default',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  active: '已启用',
  suspended: '已停用',
  rejected: '已拒绝',
}

const ROLE_OPTIONS = [
  Role.SUPPLIER,
  Role.LAB,
  Role.MERCHANT,
  Role.PARTNER,
  Role.NUTRITIONIST,
  Role.PLATFORM,
]

type CreateValues = {
  name: string
  phone: string
  password: string
  primaryRole: Role
  organizationName?: string
  dualPartner?: boolean
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<CreateValues>()
  const primaryRole = Form.useWatch('primaryRole', form)

  const load = async () => {
    setLoading(true)
    try {
      setAccounts(await api<Account[]>('/accounts'))
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const act = async (id: string, action: 'approve' | 'reject' | 'suspend') => {
    try {
      await api(`/accounts/${id}/${action}`, { method: 'POST' })
      message.success('操作成功')
      await load()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  const create = async (values: CreateValues) => {
    setSubmitting(true)
    try {
      const roles = values.dualPartner ? [values.primaryRole, Role.PARTNER] : [values.primaryRole]
      await api('/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
          password: values.password,
          primaryRole: values.primaryRole,
          roles,
          organizationName: values.organizationName,
        }),
      })
      message.success('账号已创建，等待审核')
      setOpen(false)
      form.resetFields()
      await load()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const needsOrganization =
    primaryRole === Role.SUPPLIER || primaryRole === Role.LAB || primaryRole === Role.MERCHANT

  const columns = [
    {
      title: '姓名 / 手机',
      dataIndex: 'name',
      render: (_: string, record: Account) => (
        <Space direction="vertical" size={0}>
          <span>{record.name}</span>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{record.phone}</span>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'roles',
      render: (roles: Role[]) => (
        <Space wrap>
          {roles.map((role) => (
            <Tag key={role} color="blue">
              {ROLE_LABELS[role]}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status] ?? status}</Tag>,
    },
    {
      title: '组织',
      dataIndex: 'organization',
      render: (organization: Account['organization']) => organization?.name ?? '—',
    },
    {
      title: '渠道码',
      dataIndex: 'channels',
      render: (channels: Channel[]) =>
        channels.length
          ? channels.map((channel) => (
              <Tag key={channel.id} color={channel.status === 'active' ? 'green' : 'default'}>
                {channel.code}
              </Tag>
            ))
          : '—',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Account) => (
        <Space>
          {record.status === 'pending' ? (
            <>
              <Popconfirm title="确认通过审核？" onConfirm={() => void act(record.id, 'approve')}>
                <Button size="small" type="primary">
                  通过
                </Button>
              </Popconfirm>
              <Popconfirm title="确认拒绝该账号？" onConfirm={() => void act(record.id, 'reject')}>
                <Button size="small" danger>
                  拒绝
                </Button>
              </Popconfirm>
            </>
          ) : null}
          {record.status === 'active' ? (
            <Popconfirm title="停用后渠道码与未激活盒码将失效，确认？" onConfirm={() => void act(record.id, 'suspend')}>
              <Button size="small" danger>
                停用
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <Card>
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            账号、组织与实名
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            创建与审核六类经营账号；商家审核通过后自动生成唯一渠道身份码。
          </Paragraph>
        </div>

        <Button type="primary" onClick={() => setOpen(true)}>
          新建账号
        </Button>

        <Table rowKey="id" loading={loading} columns={columns} dataSource={accounts} pagination={{ pageSize: 10 }} />
      </Space>

      <Modal
        title="新建账号"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={create} initialValues={{ primaryRole: Role.MERCHANT }}>
          <Form.Item name="name" label="姓名 / 联系人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true }, { pattern: /^1\d{10}$/, message: '11 位手机号' }]}>
            <Input maxLength={11} />
          </Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="primaryRole" label="主角色" rules={[{ required: true }]}>
            <Select
              options={ROLE_OPTIONS.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
            />
          </Form.Item>
          {needsOrganization ? (
            <Form.Item
              name="organizationName"
              label="组织名称"
              rules={[{ required: true, message: '该角色需要组织名称' }]}
            >
              <Input placeholder="例如：杭州某某健康管理有限公司" />
            </Form.Item>
          ) : null}
          {primaryRole === Role.MERCHANT ? (
            <Form.Item name="dualPartner" valuePropName="checked" label="同时开通合伙人身份">
              <Checkbox>同一主体可同时拥有商家与合伙人身份</Checkbox>
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </Card>
  )
}
