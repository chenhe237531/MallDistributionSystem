import { useRef, useState } from 'react'
import { Button, Descriptions, Popconfirm, Space, Tag, message } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import {
  ModalForm,
  PageContainer,
  ProFormCheckbox,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components'
import { ROLE_LABELS, Role } from '@mall/shared'
import { api } from '../lib/api'

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

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  active: { label: '已启用', color: 'green' },
  suspended: { label: '已停用', color: 'red' },
  rejected: { label: '已拒绝', color: 'default' },
}

const CHANNEL_STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: '启用', color: 'green' },
  inactive: { label: '停用', color: 'default' },
}

const QUALIFICATION_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  approved: { label: '已生效', color: 'green' },
  rejected: { label: '已拒绝', color: 'default' },
  expired: { label: '已过期', color: 'red' },
}

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'

const ROLE_OPTIONS = [
  Role.SUPPLIER,
  Role.LAB,
  Role.MERCHANT,
  Role.PARTNER,
  Role.NUTRITIONIST,
  Role.PLATFORM,
]

const needsOrganizationRole = (role?: Role) =>
  role === Role.SUPPLIER || role === Role.LAB || role === Role.MERCHANT

type CreateValues = {
  name: string
  phone: string
  password: string
  primaryRole: Role
  organizationName?: string
  dualPartner?: boolean
}

export default function AccountsPage() {
  const actionRef = useRef<ActionType>()
  const [createOpen, setCreateOpen] = useState(false)

  const reload = () => actionRef.current?.reload()

  const act = async (id: string, action: 'approve' | 'reject' | 'suspend') => {
    try {
      await api(`/accounts/${id}/${action}`, { method: 'POST' })
      message.success('操作成功')
      reload()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  const columns: ProColumns<Account>[] = [
    {
      title: '姓名 / 手机',
      dataIndex: 'name',
      width: 170,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <span>{entity.name}</span>
          <span style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 12 }}>{entity.phone}</span>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'roles',
      width: 220,
      render: (_, entity) => (
        <Space wrap size={4}>
          {entity.roles.map((role) => (
            <Tag key={role} color={role === entity.primaryRole ? 'blue' : 'default'}>
              {ROLE_LABELS[role]}
            </Tag>
          ))}
        </Space>
      ),
    },
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
      title: '组织',
      dataIndex: 'organization',
      width: 180,
      ellipsis: true,
      renderText: (_, entity) => entity.organization?.name ?? '—',
    },
    {
      title: '渠道',
      width: 80,
      renderText: (_, entity) => entity.channels?.length ?? 0,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      render: (_, entity) => {
        if (entity.status === 'pending') {
          return [
            <Popconfirm
              key="approve"
              title="确认通过审核？"
              onConfirm={() => void act(entity.id, 'approve')}
            >
              <a>通过</a>
            </Popconfirm>,
            <Popconfirm
              key="reject"
              title="确认拒绝该账号？"
              onConfirm={() => void act(entity.id, 'reject')}
            >
              <a style={{ color: 'var(--ant-color-error)' }}>拒绝</a>
            </Popconfirm>,
          ]
        }
        if (entity.status === 'active') {
          return [
            <Popconfirm
              key="suspend"
              title="停用后渠道码与未激活盒码将失效，确认？"
              onConfirm={() => void act(entity.id, 'suspend')}
            >
              <a style={{ color: 'var(--ant-color-error)' }}>停用</a>
            </Popconfirm>,
          ]
        }
        return [<span key="none">—</span>]
      },
    },
  ]

  return (
    <PageContainer
      header={{ title: '账号与资质', subTitle: '账号、组织与实名审核' }}
      content="创建与审核六类经营账号；商家审核通过后自动生成唯一渠道身份码。点击行首箭头查看组织、渠道与资质详情。"
    >
      <ProTable<Account>
        scroll={{ x: 'max-content' }}
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        options={{ reload: true, density: true, setting: true }}
        pagination={{ pageSize: 10 }}
        request={async () => {
          try {
            const data = await api<Account[]>('/accounts')
            return { data, success: true }
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '加载失败')
            return { data: [], success: false }
          }
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={() => setCreateOpen(true)}>
            新建账号
          </Button>,
        ]}
        expandable={{
          expandedRowRender: (record) => (
            <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered>
              <Descriptions.Item label="组织">
                {record.organization?.name ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDateTime(record.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="渠道码" span={2}>
                {record.channels?.length ? (
                  <Space wrap size={4}>
                    {record.channels.map((channel) => {
                      const meta =
                        CHANNEL_STATUS_META[channel.status] ?? {
                          label: channel.status,
                          color: 'default',
                        }
                      return (
                        <Tag key={channel.id} color={meta.color}>
                          {channel.code} · {meta.label}
                        </Tag>
                      )
                    })}
                  </Space>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="资质信息" span={2}>
                {record.qualifications?.length ? (
                  <Space wrap size={4}>
                    {record.qualifications.map((item) => {
                      const meta =
                        QUALIFICATION_STATUS_META[item.status] ?? {
                          label: item.status,
                          color: 'default',
                        }
                      return (
                        <Tag key={item.id} color={meta.color}>
                          {item.type} · {meta.label}
                          {item.expiresAt ? ` · 有效期至 ${item.expiresAt.slice(0, 10)}` : ''}
                        </Tag>
                      )
                    })}
                  </Space>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
            </Descriptions>
          ),
          rowExpandable: (record) =>
            Boolean(record.organization) ||
            record.channels?.length > 0 ||
            record.qualifications?.length > 0,
        }}
      />

      <ModalForm<CreateValues>
        title="新建账号"
        width={480}
        open={createOpen}
        modalProps={{ destroyOnHidden: true, onCancel: () => setCreateOpen(false) }}
        onOpenChange={setCreateOpen}
        initialValues={{ primaryRole: Role.MERCHANT }}
        submitter={{ searchConfig: { submitText: '创建账号', resetText: '取消' } }}
        onFinish={async (values) => {
          const roles = values.dualPartner ? [values.primaryRole, Role.PARTNER] : [values.primaryRole]
          try {
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
            setCreateOpen(false)
            reload()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '创建失败')
            return false
          }
        }}
      >
        <ProFormText
          name="name"
          label="姓名 / 联系人"
          rules={[{ required: true, message: '请输入姓名 / 联系人' }]}
        />
        <ProFormText
          name="phone"
          label="手机号"
          fieldProps={{ maxLength: 11 }}
          rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '11 位手机号' }]}
        />
        <ProFormText.Password
          name="password"
          label="初始密码"
          rules={[{ required: true, message: '请输入初始密码' }, { min: 6, message: '至少 6 位' }]}
        />
        <ProFormSelect
          name="primaryRole"
          label="主角色"
          options={ROLE_OPTIONS.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
          rules={[{ required: true, message: '请选择主角色' }]}
        />
        <ProFormDependency<{ primaryRole?: Role }> name={['primaryRole']}>
          {({ primaryRole }) => (
            <>
              {needsOrganizationRole(primaryRole) ? (
                <ProFormText
                  name="organizationName"
                  label="组织名称"
                  placeholder="例如：杭州某某健康管理有限公司"
                  rules={[{ required: true, message: '该角色需要组织名称' }]}
                />
              ) : null}
              {primaryRole === Role.MERCHANT ? (
                <ProFormCheckbox name="dualPartner" label="同时开通合伙人身份">
                  同一主体可同时拥有商家与合伙人身份
                </ProFormCheckbox>
              ) : null}
            </>
          )}
        </ProFormDependency>
      </ModalForm>
    </PageContainer>
  )
}
