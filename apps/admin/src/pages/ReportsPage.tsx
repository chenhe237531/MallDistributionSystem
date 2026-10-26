import { useRef, useState } from 'react'
import { Button, Descriptions, Drawer, Popconfirm, Space, Statistic, Tag, Typography, message } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import {
  ModalForm,
  PageContainer,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components'
import { api, getToken } from '../lib/api'

const { Paragraph, Text } = Typography

type ReportViewRecord = {
  id: string
  viewerId: string
  role: string
  action: string
  version: number
  ip?: string | null
  device?: string | null
  viewedAt: string
}

type Report = {
  id: string
  reportNo: string
  version: number
  status: string
  summary?: string | null
  missingItems: string[]
  pdfUrl?: string | null
  publishedAt?: string | null
  createdAt: string
  sample?: { id: string; sampleNo: string } | null
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  pending_review: { label: '待审核', color: 'gold' },
  published: { label: '已发布', color: 'green' },
  corrected: { label: '已更正', color: 'cyan' },
  archived: { label: '已归档', color: 'default' },
}

type CorrectValues = {
  fieldsJson: string
  summary?: string
  missingItems?: string
  pdfUrl?: string
}

export default function ReportsPage() {
  const actionRef = useRef<ActionType>()
  const [correctTarget, setCorrectTarget] = useState<Report | null>(null)
  const [viewsTarget, setViewsTarget] = useState<Report | null>(null)
  const [views, setViews] = useState<ReportViewRecord[]>([])

  const reload = () => actionRef.current?.reload()

  const submit = async (entity: Report) => {
    try {
      await api(`/reports/${entity.id}/submit`, { method: 'POST' })
      message.success(`报告 ${entity.reportNo} 已提交审核`)
      reload()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  const publish = async (entity: Report) => {
    try {
      await api(`/reports/${entity.id}/publish`, { method: 'POST' })
      message.success(`报告 ${entity.reportNo} 已发布，系统将自动生成 AI 解读`)
      reload()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  const openViews = async (entity: Report) => {
    setViewsTarget(entity)
    try {
      setViews(await api<ReportViewRecord[]>(`/reports/${entity.id}/views`))
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '加载浏览记录失败')
      setViews([])
    }
  }

  const download = async (entity: Report) => {
    try {
      const info = await api<{ url: string; reportNo: string }>(
        `/reports/${entity.id}/download`,
      )
      const headers: Record<string, string> = {}
      if (info.url.startsWith('/')) {
        headers.Authorization = `Bearer ${getToken()}`
      }
      const response = await fetch(info.url, { headers })
      if (!response.ok) {
        throw new Error(`下载失败（${response.status}）`)
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `${info.reportNo}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
      message.success('已开始下载报告 PDF')
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '下载失败')
    }
  }

  const columns: ProColumns<Report>[] = [
    {
      title: '报告编号',
      dataIndex: 'reportNo',
      width: 170,
      copyable: true,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <Text strong copyable={false}>
            {entity.reportNo}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            版本 v{entity.version}
          </Text>
        </Space>
      ),
    },
    {
      title: '样本号',
      width: 150,
      renderText: (_, entity) => entity.sample?.sampleNo ?? '—',
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
      title: '摘要',
      dataIndex: 'summary',
      ellipsis: true,
      renderText: (value?: string | null) => value ?? '—',
    },
    {
      title: '缺失项',
      width: 80,
      renderText: (_, entity) => entity.missingItems?.length ?? 0,
    },
    {
      title: 'PDF',
      dataIndex: 'pdfUrl',
      width: 70,
      renderText: (value?: string | null) => (value ? '已生成' : '未生成'),
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      width: 110,
      renderText: (value?: string | null) => (value ? value.slice(0, 10) : '—'),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 250,
      render: (_, entity) => [
        entity.status === 'draft' ? (
          <a key="submit" onClick={() => void submit(entity)}>
            提交审核
          </a>
        ) : null,
        entity.status === 'pending_review' ? (
          <Popconfirm
            key="publish"
            title="确认发布该报告？"
            description="发布后将通知用户并自动生成 AI 解读，旧版本归档"
            onConfirm={() => void publish(entity)}
          >
            <a>发布</a>
          </Popconfirm>
        ) : null,
        entity.status === 'published' || entity.status === 'corrected' ? (
          <a key="correct" onClick={() => setCorrectTarget(entity)}>
            更正
          </a>
        ) : null,
        <a key="views" onClick={() => void openViews(entity)}>
          浏览记录
        </a>,
        entity.pdfUrl ? (
          <a key="download" onClick={() => void download(entity)}>
            下载
          </a>
        ) : null,
      ],
    },
  ]

  return (
    <PageContainer
      header={{ title: '报告管理', subTitle: '检测报告审核、发布与更正' }}
      content="实验室提交报告后由平台审核发布；已发布报告如需修改走更正流程并生成新版本，旧版本自动归档。"
    >
      <ProTable<Report>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        options={{ reload: true, density: true, setting: true }}
        pagination={{ pageSize: 10 }}
        request={async () => {
          const data = await api<Report[]>('/reports')
          return { data, success: true }
        }}
      />

      <ModalForm<CorrectValues>
        title={`更正报告 · ${correctTarget?.reportNo ?? ''}（v${correctTarget?.version ?? 1}）`}
        width={560}
        open={Boolean(correctTarget)}
        modalProps={{ onCancel: () => setCorrectTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setCorrectTarget(null)
        }}
        onFinish={async (values) => {
          if (!correctTarget) return false
          try {
            await api(`/reports/${correctTarget.id}/correct`, {
              method: 'POST',
              body: JSON.stringify({
                fields: JSON.parse(values.fieldsJson) as Record<string, unknown>,
                summary: values.summary,
                missingItems: values.missingItems
                  ? values.missingItems
                      .split(/[,，]/)
                      .map((item) => item.trim())
                      .filter(Boolean)
                  : undefined,
                pdfUrl: values.pdfUrl,
              }),
            })
            message.success('更正报告已创建，进入待审核状态')
            setCorrectTarget(null)
            reload()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '更正失败')
            return false
          }
        }}
      >
        <ProFormTextArea
          name="fieldsJson"
          label="指标数据（JSON）"
          placeholder='如 {"hemoglobin":"135 g/L"}'
          fieldProps={{ rows: 6 }}
          rules={[
            { required: true, message: '请填写指标数据' },
            {
              validator: (_rule: unknown, value: string) => {
                if (!value) return Promise.resolve()
                try {
                  const parsed = JSON.parse(value)
                  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('必须是 JSON 对象'))
                } catch {
                  return Promise.reject(new Error('请输入合法的 JSON 对象'))
                }
              },
            },
          ]}
        />
        <ProFormTextArea
          name="summary"
          label="报告摘要（可选）"
          fieldProps={{ rows: 3 }}
        />
        <ProFormText
          name="missingItems"
          label="缺失项（可选）"
          placeholder="多个用英文逗号分隔，如：血脂,肝功能"
        />
        <ProFormText name="pdfUrl" label="PDF 地址（可选）" placeholder="https://..." />
      </ModalForm>

      <Drawer
        width={640}
        open={Boolean(viewsTarget)}
        onClose={() => setViewsTarget(null)}
        title={viewsTarget ? `浏览记录 · ${viewsTarget.reportNo}` : '浏览记录'}
      >
        <Statistic title="累计浏览 / 下载次数" value={views.length} suffix="次" />
        <div style={{ marginTop: 16 }}>
          <ProTable<ReportViewRecord>
            rowKey="id"
            size="small"
            search={false}
            options={false}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: '查看人', dataIndex: 'viewerId', ellipsis: true },
              { title: '角色', dataIndex: 'role', width: 100 },
              {
                title: '行为',
                dataIndex: 'action',
                width: 90,
                renderText: (value: string) => (value === 'download' ? '下载' : '查看'),
              },
              { title: '版本', dataIndex: 'version', width: 70 },
              {
                title: '时间',
                dataIndex: 'viewedAt',
                width: 160,
                renderText: (value: string) => value.slice(0, 19).replace('T', ' '),
              },
            ]}
            dataSource={views}
          />
        </div>
        {viewsTarget ? (
          <Descriptions column={1} size="small" bordered style={{ marginTop: 16 }}>
            <Descriptions.Item label="缺失项">
              {viewsTarget.missingItems?.length
                ? viewsTarget.missingItems.join('、')
                : '无'}
            </Descriptions.Item>
            <Descriptions.Item label="摘要">
              <Paragraph style={{ marginBottom: 0 }}>{viewsTarget.summary ?? '—'}</Paragraph>
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </PageContainer>
  )
}
