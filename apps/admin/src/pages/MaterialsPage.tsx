import { useRef, useState } from 'react'
import { Button, Descriptions, Drawer, Popconfirm, Space, Switch, Tag, Typography, message } from 'antd'
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
import { api } from '../lib/api'

const { Paragraph, Text } = Typography

type MaterialTemplate = {
  id: string
  code: string
  name: string
  category: string
  contentType: string
  body: string
  lockedClauses: string[]
  applicableProductIds: string[]
  validUntil?: string | null
  active: boolean
  createdAt: string
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  text: '纯文案',
  image_text: '图文',
}

type CreateValues = {
  code: string
  name: string
  category: string
  contentType: string
  body: string
  lockedClauses?: string
  applicableProductIds?: string
  validUntil?: string
}

export default function MaterialsPage() {
  const actionRef = useRef<ActionType>()
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<MaterialTemplate | null>(null)

  const reload = () => actionRef.current?.reload()

  const toggleStatus = async (entity: MaterialTemplate, active: boolean) => {
    try {
      await api(`/materials/templates/${entity.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      })
      message.success(`模板「${entity.name}」已${active ? '启用' : '停用'}`)
      reload()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  const columns: ProColumns<MaterialTemplate>[] = [
    { title: '编码', dataIndex: 'code', width: 140, copyable: true },
    {
      title: '模板名称',
      dataIndex: 'name',
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <Text strong>{entity.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {entity.category}
          </Text>
        </Space>
      ),
    },
    {
      title: '内容类型',
      dataIndex: 'contentType',
      width: 100,
      renderText: (value: string) => CONTENT_TYPE_LABELS[value] ?? value,
    },
    {
      title: '锁定条款',
      width: 90,
      renderText: (_, entity) => entity.lockedClauses?.length ?? 0,
    },
    {
      title: '适用商品',
      width: 90,
      renderText: (_, entity) =>
        entity.applicableProductIds?.length ? `${entity.applicableProductIds.length} 个` : '不限',
    },
    {
      title: '有效期至',
      dataIndex: 'validUntil',
      width: 110,
      renderText: (value?: string | null) => (value ? value.slice(0, 10) : '长期'),
    },
    {
      title: '状态',
      dataIndex: 'active',
      width: 80,
      render: (_, entity) =>
        entity.active ? <Tag color="green">启用中</Tag> : <Tag color="default">已停用</Tag>,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      render: (_, entity) => [
        <a key="detail" onClick={() => setDetail(entity)}>
          详情
        </a>,
        <Popconfirm
          key="toggle"
          title={entity.active ? '确认停用该模板？' : '确认启用该模板？'}
          description={entity.active ? '停用后商家端无法再基于该模板生成素材' : undefined}
          onConfirm={() => void toggleStatus(entity, !entity.active)}
        >
          <a style={entity.active ? { color: '#cf1322' } : undefined}>
            {entity.active ? '停用' : '启用'}
          </a>
        </Popconfirm>,
      ],
    },
  ]

  return (
    <PageContainer
      header={{ title: '素材模板', subTitle: '营销素材模板维护' }}
      content="维护商家端可用的素材模板：设置正文与占位符、锁定条款、适用商品与有效期；停用的模板商家不可见。"
    >
      <ProTable<MaterialTemplate>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        options={{ reload: true, density: true, setting: true }}
        pagination={{ pageSize: 10 }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={() => setCreateOpen(true)}>
            新建模板
          </Button>,
        ]}
        request={async () => {
          const data = await api<MaterialTemplate[]>('/materials/templates?includeInactive=true')
          return { data, success: true }
        }}
      />

      <ModalForm<CreateValues>
        title="新建素材模板"
        width={560}
        open={createOpen}
        modalProps={{ onCancel: () => setCreateOpen(false) }}
        onOpenChange={setCreateOpen}
        onFinish={async (values) => {
          try {
            await api('/materials/templates', {
              method: 'POST',
              body: JSON.stringify({
                code: values.code,
                name: values.name,
                category: values.category,
                contentType: values.contentType,
                body: values.body,
                lockedClauses: values.lockedClauses
                  ? values.lockedClauses
                      .split(/[,，]/)
                      .map((item) => item.trim())
                      .filter(Boolean)
                  : undefined,
                applicableProductIds: values.applicableProductIds
                  ? values.applicableProductIds
                      .split(/[,，]/)
                      .map((item) => item.trim())
                      .filter(Boolean)
                  : undefined,
                validUntil: values.validUntil
                  ? new Date(values.validUntil).toISOString()
                  : undefined,
              }),
            })
            message.success('模板已创建')
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
          name="code"
          label="模板编码"
          placeholder="唯一编码，如 promo_qa"
          rules={[{ required: true, message: '请输入模板编码' }, { min: 2 }]}
        />
        <ProFormText
          name="name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }, { min: 2 }]}
        />
        <ProFormText
          name="category"
          label="分类"
          placeholder="如 朋友圈 / 社群 / 短信"
          rules={[{ required: true, message: '请输入分类' }]}
        />
        <ProFormSelect
          name="contentType"
          label="内容类型"
          options={[
            { label: '纯文案', value: 'text' },
            { label: '图文', value: 'image_text' },
          ]}
          rules={[{ required: true, message: '请选择内容类型' }]}
        />
        <ProFormTextArea
          name="body"
          label="模板正文"
          placeholder="支持占位符：{{merchantName}} {{storeName}} {{storeAddress}} {{qrPayload}}"
          fieldProps={{ rows: 6 }}
          rules={[{ required: true, message: '请输入模板正文' }]}
        />
        <ProFormText
          name="lockedClauses"
          label="锁定条款（可选）"
          placeholder="多个用英文逗号分隔，商家生成时不可修改"
        />
        <ProFormText
          name="applicableProductIds"
          label="适用商品 ID（可选）"
          placeholder="多个用英文逗号分隔，留空表示全部商品"
        />
        <ProFormDatePicker name="validUntil" label="有效期至（可选）" />
      </ModalForm>

      <Drawer
        width={520}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `模板详情 · ${detail.name}` : '模板详情'}
      >
        {detail ? (
          <Space direction="vertical" size={16} style={{ display: 'flex' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="编码">{detail.code}</Descriptions.Item>
              <Descriptions.Item label="分类">{detail.category}</Descriptions.Item>
              <Descriptions.Item label="内容类型">
                {CONTENT_TYPE_LABELS[detail.contentType] ?? detail.contentType}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {detail.active ? <Tag color="green">启用中</Tag> : <Tag>已停用</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="有效期至">
                {detail.validUntil ? detail.validUntil.slice(0, 10) : '长期'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {detail.createdAt.slice(0, 10)}
              </Descriptions.Item>
              <Descriptions.Item label="锁定条款" span={2}>
                {detail.lockedClauses?.length ? detail.lockedClauses.join('、') : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="适用商品" span={2}>
                {detail.applicableProductIds?.length
                  ? detail.applicableProductIds.join('、')
                  : '不限'}
              </Descriptions.Item>
            </Descriptions>
            <div>
              <Text strong>模板正文</Text>
              <Paragraph
                style={{
                  marginTop: 8,
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  marginBottom: 0,
                }}
              >
                {detail.body}
              </Paragraph>
            </div>
            <Space>
              <Text type="secondary">快捷启停：</Text>
              <Switch
                checked={detail.active}
                onChange={(checked) => {
                  setDetail({ ...detail, active: checked })
                  void toggleStatus(detail, checked)
                }}
                checkedChildren="启用"
                unCheckedChildren="停用"
              />
            </Space>
          </Space>
        ) : null}
      </Drawer>
    </PageContainer>
  )
}
