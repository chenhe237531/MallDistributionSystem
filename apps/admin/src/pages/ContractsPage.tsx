import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Popconfirm,
  Radio,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
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
import { ROLE_LABELS, Role } from '@mall/shared'
import { api } from '../lib/api'

const { Text } = Typography

type Provider = 'esignbao' | 'tencent'

type ContractTemplate = {
  id: string
  code: string
  name: string
  version: number
  partyType: Role
  body: string
  lockedClauses: string[]
  active: boolean
  createdAt: string
}

type ESignTask = { id: string; provider: string; status: string; signUrl: string }

type Contract = {
  id: string
  contractNo: string
  templateId: string
  templateVersion: number
  template?: ContractTemplate | null
  subjectUserId: string
  subjectType: Role
  status: string
  signMode?: string | null
  provider?: string | null
  evidenceNo?: string | null
  effectiveAt?: string | null
  expiresAt?: string | null
  terminatedAt?: string | null
  createdAt: string
  tasks?: ESignTask[]
}

type Account = {
  id: string
  name: string
  phone: string
  roles: Role[]
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  pending_sign: { label: '待签署', color: 'gold' },
  signing: { label: '签署中', color: 'processing' },
  active: { label: '已生效', color: 'green' },
  pending_renewal: { label: '待续签', color: 'orange' },
  terminated: { label: '已解除', color: 'red' },
}

const PROVIDER_LABELS: Record<Provider, string> = {
  esignbao: 'e签宝',
  tencent: '腾讯电子签',
}

const SUBJECT_TYPE_OPTIONS = Object.values(Role)
  .filter((role) => role !== Role.PLATFORM && role !== Role.CUSTOMER)
  .map((role) => ({ label: ROLE_LABELS[role], value: role }))

type CreateTemplateValues = {
  code: string
  name: string
  version: number
  partyType: Role
  body: string
  lockedClauses?: string
}

type OfflineValues = {
  templateId: string
  subjectUserId: string
  contractNo?: string
  validFrom: string
  validTo?: string
  scanFileUrl?: string
}

type InitiateValues = { provider?: Provider }

export default function ContractsPage() {
  const templateActionRef = useRef<ActionType>()
  const contractActionRef = useRef<ActionType>()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false)
  const [offlineOpen, setOfflineOpen] = useState(false)
  const [offlineTemplateId, setOfflineTemplateId] = useState<string>()
  const [initiateTarget, setInitiateTarget] = useState<Contract | null>(null)

  const reloadTemplates = () => templateActionRef.current?.reload()
  const reloadContracts = () => contractActionRef.current?.reload()

  const loadExtras = useCallback(async () => {
    try {
      const [templateList, accountList] = await Promise.all([
        api<ContractTemplate[]>('/contracts/templates'),
        api<Account[]>('/accounts'),
      ])
      setTemplates(templateList)
      setAccounts(accountList)
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '加载模板或账号失败')
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const current = await api<Provider>('/contracts/settings/provider')
        setProvider(current)
      } catch (cause) {
        message.error(cause instanceof Error ? cause.message : '加载电子签设置失败')
      }
    })()
    void loadExtras()
  }, [loadExtras])

  const switchProvider = async (value: Provider) => {
    const previous = provider
    setProvider(value)
    try {
      await api('/contracts/settings/provider', {
        method: 'PATCH',
        body: JSON.stringify({ provider: value }),
      })
      message.success(`电子签服务商已切换为${PROVIDER_LABELS[value]}`)
    } catch (cause) {
      setProvider(previous)
      message.error(cause instanceof Error ? cause.message : '切换失败')
    }
  }

  const mockSign = async (entity: Contract) => {
    try {
      await api(`/contracts/${entity.id}/mock-sign`, { method: 'POST' })
      message.success(`合同 ${entity.contractNo} 已完成签署并生效`)
      reloadContracts()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  const terminate = async (entity: Contract) => {
    try {
      await api(`/contracts/${entity.id}/terminate`, { method: 'POST' })
      message.success(`合同 ${entity.contractNo} 已解除`)
      reloadContracts()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  const accountLabel = (userId: string) => {
    const account = accounts.find((item) => item.id === userId)
    return account ? `${account.name}（${account.phone}）` : userId
  }

  const templateColumns: ProColumns<ContractTemplate>[] = [
    { title: '编码', dataIndex: 'code', width: 160, copyable: true },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '版本', dataIndex: 'version', width: 70, renderText: (v: number) => `v${v}` },
    {
      title: '签署方类型',
      dataIndex: 'partyType',
      width: 110,
      renderText: (value: Role) => ROLE_LABELS[value] ?? value,
    },
    {
      title: '锁定条款',
      width: 90,
      renderText: (_, entity) => entity.lockedClauses?.length ?? 0,
    },
    {
      title: '状态',
      dataIndex: 'active',
      width: 80,
      renderText: (value: boolean) => (value ? '启用' : '停用'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 110,
      renderText: (value: string) => value.slice(0, 10),
    },
  ]

  const contractColumns: ProColumns<Contract>[] = [
    { title: '合同编号', dataIndex: 'contractNo', width: 160, copyable: true },
    {
      title: '合同模板',
      width: 180,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <Text strong>{entity.template?.name ?? '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {entity.template?.code ?? '—'} · v{entity.templateVersion}
          </Text>
        </Space>
      ),
    },
    {
      title: '签署主体',
      width: 170,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <Text>{accountLabel(entity.subjectUserId)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {ROLE_LABELS[entity.subjectType] ?? entity.subjectType}
          </Text>
        </Space>
      ),
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
      title: '签署方式',
      width: 100,
      renderText: (_, entity) =>
        entity.signMode === 'offline'
          ? '线下签署'
          : (entity.provider ? (PROVIDER_LABELS[entity.provider as Provider] ?? entity.provider) : '—'),
    },
    {
      title: '生效 / 到期',
      width: 170,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>
            生效：{entity.effectiveAt ? entity.effectiveAt.slice(0, 10) : '—'}
          </Text>
          <Text style={{ fontSize: 12 }}>
            到期：{entity.expiresAt ? entity.expiresAt.slice(0, 10) : '长期'}
          </Text>
        </Space>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      render: (_, entity) => [
        entity.status === 'draft' || entity.status === 'pending_renewal' ? (
          <a key="initiate" onClick={() => setInitiateTarget(entity)}>
            发起签署
          </a>
        ) : null,
        entity.status === 'pending_sign' ? (
          <Popconfirm
            key="mockSign"
            title="确认模拟签署完成？"
            description="用于联调环境快速走通签署流程"
            onConfirm={() => void mockSign(entity)}
          >
            <a>模拟签署</a>
          </Popconfirm>
        ) : null,
        entity.status !== 'terminated' ? (
          <Popconfirm
            key="terminate"
            title="确认解除该合同？"
            description="解除后将同步停用该主体的渠道身份"
            onConfirm={() => void terminate(entity)}
          >
            <a style={{ color: 'var(--ant-color-error)' }}>解除</a>
          </Popconfirm>
        ) : null,
      ],
    },
  ]

  return (
    <PageContainer
      header={{ title: '合同管理', subTitle: '模板、电子签与合同全流程' }}
      content="维护各角色合同模板，配置电子签服务商；支持电子签发起与模拟签署，以及商家 / 合伙人 / 营养师线下合同录入与解除。"
    >
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
        <Card size="small" title="电子签服务商">
          <Row align="middle">
            <Col>
              <Radio.Group
                value={provider ?? undefined}
                onChange={(event) => void switchProvider(event.target.value as Provider)}
                options={[
                  { label: PROVIDER_LABELS.esignbao, value: 'esignbao' },
                  { label: PROVIDER_LABELS.tencent, value: 'tencent' },
                ]}
                optionType="button"
              />
            </Col>
            <Col style={{ marginLeft: 16 }}>
              <Text type="secondary">新发起的签署任务将使用该服务商</Text>
            </Col>
          </Row>
        </Card>

        <ProTable<ContractTemplate>
          scroll={{ x: 'max-content' }}
          rowKey="id"
          actionRef={templateActionRef}
          headerTitle="合同模板"
          columns={templateColumns}
          search={false}
          options={{ reload: true, density: true, setting: true }}
          pagination={false}
          toolBarRender={() => [
            <Button key="create" type="primary" onClick={() => setCreateTemplateOpen(true)}>
              新建模板
            </Button>,
          ]}
          dataSource={templates}
        />

        <ProTable<Contract>
          scroll={{ x: 'max-content' }}
          rowKey="id"
          actionRef={contractActionRef}
          headerTitle="合同列表"
          columns={contractColumns}
          search={false}
          options={{ reload: true, density: true, setting: true }}
          pagination={{ pageSize: 10 }}
          toolBarRender={() => [
            <Button key="offline" onClick={() => setOfflineOpen(true)}>
              录入线下合同
            </Button>,
          ]}
          request={async () => {
            const data = await api<Contract[]>('/contracts')
            return { data, success: true }
          }}
        />
      </Space>

      <ModalForm<CreateTemplateValues>
        title="新建合同模板"
        width={560}
        open={createTemplateOpen}
        modalProps={{ onCancel: () => setCreateTemplateOpen(false) }}
        onOpenChange={setCreateTemplateOpen}
        onFinish={async (values) => {
          try {
            await api('/contracts/templates', {
              method: 'POST',
              body: JSON.stringify({
                code: values.code,
                name: values.name,
                version: values.version,
                partyType: values.partyType,
                body: values.body,
                lockedClauses: values.lockedClauses
                  ? values.lockedClauses
                      .split(/[,，]/)
                      .map((item) => item.trim())
                      .filter(Boolean)
                  : undefined,
              }),
            })
            message.success('模板已创建')
            setCreateTemplateOpen(false)
            reloadTemplates()
            void loadExtras()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '创建失败')
            return false
          }
        }}
      >
        <ProFormText
          name="code"
          label="模板编码"
          placeholder="如 merchant_onboarding"
          rules={[{ required: true, message: '请输入模板编码' }]}
        />
        <ProFormText
          name="name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        />
        <ProFormDigit
          name="version"
          label="版本号"
          min={1}
          fieldProps={{ precision: 0 }}
          rules={[{ required: true, message: '请输入版本号' }]}
        />
        <ProFormSelect
          name="partyType"
          label="签署方类型"
          options={SUBJECT_TYPE_OPTIONS}
          rules={[{ required: true, message: '请选择签署方类型' }]}
        />
        <ProFormTextArea
          name="body"
          label="合同正文"
          fieldProps={{ rows: 8 }}
          rules={[{ required: true, message: '请输入合同正文' }]}
        />
        <ProFormText
          name="lockedClauses"
          label="锁定条款（可选）"
          placeholder="多个用英文逗号分隔"
        />
      </ModalForm>

      <ModalForm<OfflineValues>
        title="录入线下合同"
        width={560}
        open={offlineOpen}
        modalProps={{ onCancel: () => setOfflineOpen(false) }}
        onOpenChange={setOfflineOpen}
        onFinish={async (values) => {
          try {
            await api('/contracts/offline', {
              method: 'POST',
              body: JSON.stringify({
                templateId: values.templateId,
                subjectUserId: values.subjectUserId,
                contractNo: values.contractNo,
                validFrom: new Date(values.validFrom).toISOString(),
                validTo: values.validTo ? new Date(values.validTo).toISOString() : undefined,
                scanFileUrl: values.scanFileUrl,
              }),
            })
            message.success('线下合同已录入并生效')
            setOfflineOpen(false)
            setOfflineTemplateId(undefined)
            reloadContracts()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '录入失败')
            return false
          }
        }}
      >
        <ProFormSelect
          name="templateId"
          label="合同模板"
          options={templates.map((template) => ({
            value: template.id,
            label: `${template.name}（${ROLE_LABELS[template.partyType] ?? template.partyType} · v${template.version}）`,
          }))}
          fieldProps={{ onChange: (value: string) => setOfflineTemplateId(value) }}
          rules={[{ required: true, message: '请选择合同模板' }]}
        />
        <ProFormSelect
          name="subjectUserId"
          label="签署主体"
          options={accounts
            .filter((account) => {
              const template = templates.find((item) => item.id === offlineTemplateId)
              return template ? account.roles?.includes(template.partyType) : true
            })
            .map((account) => ({
              value: account.id,
              label: `${account.name}（${account.phone}）`,
            }))}
          showSearch
          fieldProps={{ optionFilterProp: 'label' }}
          rules={[{ required: true, message: '请选择签署主体' }]}
        />
        <ProFormText name="contractNo" label="合同编号（可选，留空自动生成）" />
        <ProFormDatePicker
          name="validFrom"
          label="生效日期"
          rules={[{ required: true, message: '请选择生效日期' }]}
        />
        <ProFormDatePicker name="validTo" label="到期日期（可选）" />
        <ProFormText name="scanFileUrl" label="扫描件地址（可选）" placeholder="https://..." />
      </ModalForm>

      <ModalForm<InitiateValues>
        title={`发起签署 · ${initiateTarget?.contractNo ?? ''}`}
        width={460}
        open={Boolean(initiateTarget)}
        modalProps={{ onCancel: () => setInitiateTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setInitiateTarget(null)
        }}
        onFinish={async (values) => {
          if (!initiateTarget) return false
          try {
            await api(`/contracts/${initiateTarget.id}/initiate`, {
              method: 'POST',
              body: JSON.stringify({ provider: values.provider }),
            })
            message.success('签署任务已发起，等待对方签署')
            setInitiateTarget(null)
            reloadContracts()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '发起失败')
            return false
          }
        }}
      >
        <ProFormSelect
          name="provider"
          label="电子签服务商（可选，留空使用平台默认）"
          options={[
            { label: PROVIDER_LABELS.esignbao, value: 'esignbao' },
            { label: PROVIDER_LABELS.tencent, value: 'tencent' },
          ]}
        />
      </ModalForm>
    </PageContainer>
  )
}
