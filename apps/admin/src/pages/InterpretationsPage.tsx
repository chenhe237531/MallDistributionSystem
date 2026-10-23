import { useCallback, useEffect, useState } from 'react'
import { Card, Col, Drawer, Empty, Popconfirm, Row, Select, Space, Spin, Tag, Typography, message } from 'antd'
import type { ProColumns } from '@ant-design/pro-components'
import {
  ModalForm,
  PageContainer,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components'
import { api } from '../lib/api'

const { Paragraph, Text, Title } = Typography

type ReportLite = {
  id: string
  reportNo: string
  version: number
  status: string
  sample?: { sampleNo: string } | null
}

type InterpretationView = {
  id?: string
  reportId: string
  version?: number
  status: string
  sections?: Partial<Record<string, string>>
  sensitiveHits?: string[]
  reviewNote?: string | null
  contentHidden?: boolean
  modelVersion?: string
  promptVersion?: string
  reviewedAt?: string | null
  publishedAt?: string | null
}

type NutritionPlan = {
  id: string
  cycle: string
  status: string
  meals: unknown
  followUpNodes: unknown
  nutritionistId: string
  publishedAt?: string | null
  createdAt: string
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  missing: { label: '暂无解读', color: 'default' },
  generating: { label: '生成中', color: 'processing' },
  generated: { label: 'AI 已生成', color: 'blue' },
  blocked: { label: '命中敏感词', color: 'red' },
  reviewed: { label: '已复核', color: 'cyan' },
  rejected: { label: '已驳回', color: 'orange' },
  failed: { label: '生成失败', color: 'red' },
}

const SECTION_LABELS: Record<string, string> = {
  metricExplanation: '指标解读',
  abnormalItems: '异常项目',
  possibleFactors: '可能因素',
  lifestyleAdvice: '生活建议',
  retestAdvice: '复查建议',
  disclaimer: '免责声明',
}

const SECTION_ORDER = [
  'metricExplanation',
  'abnormalItems',
  'possibleFactors',
  'lifestyleAdvice',
  'retestAdvice',
  'disclaimer',
]

type EditValues = Partial<Record<string, string>> & { note?: string }
type AnnotateValues = { note: string }
type RejectValues = { reason?: string }

export default function InterpretationsPage() {
  const [reports, setReports] = useState<ReportLite[]>([])
  const [reportId, setReportId] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [interpretation, setInterpretation] = useState<InterpretationView | null>(null)
  const [plans, setPlans] = useState<NutritionPlan[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [annotateOpen, setAnnotateOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [planDetail, setPlanDetail] = useState<NutritionPlan | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const data = await api<ReportLite[]>('/reports')
        setReports(data)
        const firstPublished = data.find((item) => item.status === 'published') ?? data[0]
        if (firstPublished) {
          setReportId(firstPublished.id)
        }
      } catch (cause) {
        message.error(cause instanceof Error ? cause.message : '加载报告列表失败')
      }
    })()
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const [latest, planList] = await Promise.all([
        api<InterpretationView>(`/interpretations/report/${id}/latest`),
        api<NutritionPlan[]>(`/nutrition-plans/report/${id}`),
      ])
      setInterpretation(latest.status === 'missing' ? null : latest)
      setPlans(planList)
    } catch (cause) {
      setInterpretation(null)
      setPlans([])
      message.error(cause instanceof Error ? cause.message : '加载解读失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (reportId) {
      void loadDetail(reportId)
    }
  }, [reportId, loadDetail])

  const mutation = async (action: () => Promise<unknown>, successText: string) => {
    try {
      await action()
      message.success(successText)
      if (reportId) {
        await loadDetail(reportId)
      }
      return true
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
      return false
    }
  }

  const generate = () =>
    mutation(
      () => api(`/interpretations/report/${reportId}/generate`, { method: 'POST' }),
      '已触发 AI 生成解读',
    )

  const simpleAction = (path: string, successText: string) =>
    mutation(() => api(path, { method: 'POST' }), successText)

  const statusMeta = interpretation
    ? (STATUS_META[interpretation.status] ?? { label: interpretation.status, color: 'default' })
    : STATUS_META.missing

  const canOperate = Boolean(interpretation?.id) && interpretation?.contentHidden !== true

  const planColumns: ProColumns<NutritionPlan>[] = [
    { title: '方案周期', dataIndex: 'cycle', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, entity) =>
        entity.status === 'published' ? (
          <Tag color="green">已发布</Tag>
        ) : (
          <Tag color="gold">草稿</Tag>
        ),
    },
    {
      title: '随访节点',
      width: 90,
      renderText: (_, entity) =>
        Array.isArray(entity.followUpNodes) ? entity.followUpNodes.length : 0,
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      width: 110,
      renderText: (value?: string | null) => (value ? value.slice(0, 10) : '—'),
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
      width: 130,
      render: (_, entity) => [
        <a key="detail" onClick={() => setPlanDetail(entity)}>
          详情
        </a>,
        entity.status !== 'published' ? (
          <Popconfirm
            key="publish"
            title="确认发布该营养方案？"
            onConfirm={() =>
              void simpleAction(
                `/nutrition-plans/${entity.id}/publish`,
                '营养方案已发布',
              )
            }
          >
            <a>发布</a>
          </Popconfirm>
        ) : null,
      ],
    },
  ]

  return (
    <PageContainer
      header={{ title: 'AI 解读', subTitle: '解读生成、复核与营养方案' }}
      content="选择已发布报告查看最新 AI 解读，完成人工复核（采纳 / 编辑 / 批注 / 驳回）后发布，并管理对应营养方案。"
    >
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
        <Card size="small">
          <Space wrap>
            <Text strong>选择报告：</Text>
            <Select<string>
              style={{ minWidth: 380 }}
              placeholder="请选择报告"
              value={reportId}
              onChange={(value) => setReportId(value)}
              options={reports.map((report) => ({
                value: report.id,
                label: `${report.reportNo}（v${report.version} · ${report.sample?.sampleNo ?? '—'}）`,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Space>
        </Card>

        {loading ? (
          <Card>
            <Spin />
          </Card>
        ) : (
          <Card
            title={
              <Space>
                <span>最新解读</span>
                <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                {interpretation?.version ? <Text type="secondary">v{interpretation.version}</Text> : null}
                {interpretation?.sensitiveHits?.length ? (
                  <Tag color="red">敏感词：{interpretation.sensitiveHits.join('、')}</Tag>
                ) : null}
              </Space>
            }
            extra={
              interpretation?.id ? (
                <Space wrap>
                  <a onClick={() => void generate()}>重新生成</a>
                  <a
                    onClick={() =>
                      void simpleAction(
                        `/interpretations/${interpretation.id}/adopt`,
                        '解读已采纳（复核通过）',
                      )
                    }
                  >
                    采纳
                  </a>
                  <a onClick={() => setEditOpen(true)}>编辑</a>
                  <a onClick={() => setAnnotateOpen(true)}>批注</a>
                  <a onClick={() => setRejectOpen(true)} style={{ color: '#d46b08' }}>
                    驳回
                  </a>
                  <Popconfirm
                    title="确认发布该解读？"
                    description="发布后用户端可见，需先完成复核"
                    onConfirm={() =>
                      void simpleAction(
                        `/interpretations/${interpretation.id}/publish`,
                        '解读已发布',
                      )
                    }
                  >
                    <a>发布</a>
                  </Popconfirm>
                </Space>
              ) : (
                interpretation === null && reportId ? (
                  <a onClick={() => void generate()}>生成解读</a>
                ) : null
              )
            }
          >
            {interpretation && interpretation.sections && !interpretation.contentHidden ? (
              <Row gutter={[24, 16]}>
                {SECTION_ORDER.map((key) => (
                  <Col key={key} span={12}>
                    <Title level={5} style={{ marginBottom: 4 }}>
                      {SECTION_LABELS[key] ?? key}
                    </Title>
                    <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                      {interpretation.sections?.[key] || '—'}
                    </Paragraph>
                  </Col>
                ))}
                {interpretation.reviewNote ? (
                  <Col span={24}>
                    <Text type="warning">复核批注：{interpretation.reviewNote}</Text>
                  </Col>
                ) : null}
              </Row>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  interpretation?.contentHidden
                    ? '解读内容暂不可见（可能未复核发布或无权查看）'
                    : '该报告尚未生成解读'
                }
              />
            )}
            {interpretation?.modelVersion ? (
              <Space style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  模型：{interpretation.modelVersion} · 提示词：{interpretation.promptVersion}
                </Text>
              </Space>
            ) : null}
          </Card>
        )}

        <Card title="营养方案（按报告）">
          <ProTable<NutritionPlan>
            rowKey="id"
            size="small"
            columns={planColumns}
            search={false}
            options={false}
            pagination={false}
            dataSource={plans}
            locale={{ emptyText: '该报告暂无营养方案' }}
          />
        </Card>
      </Space>

      <ModalForm<EditValues>
        title={`编辑解读 · v${interpretation?.version ?? 1}`}
        width={640}
        open={editOpen}
        modalProps={{ onCancel: () => setEditOpen(false) }}
        onOpenChange={setEditOpen}
        initialValues={interpretation?.sections ?? undefined}
        onFinish={async (values) => {
          if (!interpretation?.id) return false
          const sections: Record<string, string> = {}
          for (const key of SECTION_ORDER) {
            sections[key] = (values[key] ?? '').trim()
            if (!sections[key]) {
              message.error(`请填写「${SECTION_LABELS[key]}」`)
              return false
            }
          }
          return mutation(
            () =>
              api(`/interpretations/${interpretation.id}/edit`, {
                method: 'POST',
                body: JSON.stringify({ sections, note: values.note }),
              }),
            '解读已编辑保存',
          )
        }}
      >
        {SECTION_ORDER.map((key) => (
          <ProFormTextArea
            key={key}
            name={key}
            label={SECTION_LABELS[key]}
            fieldProps={{ rows: 3 }}
            rules={[{ required: true, message: `请填写${SECTION_LABELS[key]}` }]}
          />
        ))}
        <ProFormTextArea name="note" label="修改说明（可选）" fieldProps={{ rows: 2 }} />
      </ModalForm>

      <ModalForm<AnnotateValues>
        title="复核批注"
        width={460}
        open={annotateOpen}
        modalProps={{ onCancel: () => setAnnotateOpen(false) }}
        onOpenChange={setAnnotateOpen}
        initialValues={{ note: interpretation?.reviewNote ?? '' }}
        onFinish={async (values) => {
          if (!interpretation?.id) return false
          return mutation(
            () =>
              api(`/interpretations/${interpretation.id}/annotate`, {
                method: 'POST',
                body: JSON.stringify({ note: values.note }),
              }),
            '批注已保存',
          )
        }}
      >
        <ProFormTextArea
          name="note"
          label="批注内容"
          fieldProps={{ rows: 4 }}
          rules={[{ required: true, message: '请填写批注内容' }]}
        />
      </ModalForm>

      <ModalForm<RejectValues>
        title="驳回解读"
        width={460}
        open={rejectOpen}
        modalProps={{ onCancel: () => setRejectOpen(false) }}
        onOpenChange={setRejectOpen}
        onFinish={async (values) => {
          if (!interpretation?.id) return false
          return mutation(
            () =>
              api(`/interpretations/${interpretation.id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason: values.reason }),
              }),
            '解读已驳回',
          )
        }}
      >
        <ProFormTextArea
          name="reason"
          label="驳回原因（可选）"
          placeholder="说明驳回原因，便于后续重新生成或编辑"
          fieldProps={{ rows: 3 }}
        />
      </ModalForm>

      <Drawer
        width={520}
        open={Boolean(planDetail)}
        onClose={() => setPlanDetail(null)}
        title={planDetail ? `营养方案详情 · ${planDetail.cycle}` : '营养方案详情'}
      >
        {planDetail ? (
          <Space direction="vertical" size={16} style={{ display: 'flex' }}>
            <div>
              <Text strong>膳食安排（meals）</Text>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 12 }}>
                {JSON.stringify(planDetail.meals, null, 2)}
              </pre>
            </div>
            <div>
              <Text strong>随访节点（followUpNodes）</Text>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 12 }}>
                {JSON.stringify(planDetail.followUpNodes, null, 2)}
              </pre>
            </div>
          </Space>
        ) : null}
      </Drawer>
    </PageContainer>
  )
}
