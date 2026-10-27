import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Col, Descriptions, Drawer, Row, Space, Statistic, Tag, Typography, message } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import {
  ModalForm,
  PageContainer,
  ProFormCheckbox,
  ProFormDigit,
  ProFormList,
  ProFormRadio,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components'
import { ROLE_LABELS, Role } from '@mall/shared'
import { api } from '../lib/api'

const { Text } = Typography

type Chapter = { id: string; title: string; content: string; order: number }

type Question = {
  id: string
  type: string
  prompt: string
  options: Array<{ key: string; text: string }>
  answer?: string | string[]
  score: number
}

type Course = {
  id: string
  code: string
  name: string
  category: string
  audience: Role[]
  required: boolean
  validityMonths: number
  chapters: Chapter[]
  questions: Question[]
  createdAt: string
}

type SalesRecord = {
  id: string
  status: string
  progress: number
  examScore?: number | null
  attemptCount: number
  passedAt?: string | null
  expiresAt?: string | null
  user: { id: string; name: string; phone: string }
  course: { id: string; name: string; required: boolean; validityMonths: number }
}

type MerchantSales = {
  records: SalesRecord[]
  completionRate: number
  failed: SalesRecord[]
  expiring: SalesRecord[]
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  not_started: { label: '未开始', color: 'default' },
  learning: { label: '学习中', color: 'blue' },
  pending_exam: { label: '待考试', color: 'gold' },
  passed: { label: '已通过', color: 'green' },
  expired: { label: '已过期', color: 'red' },
}

const AUDIENCE_OPTIONS = Object.values(Role)
  .filter((role) => role !== Role.PLATFORM)
  .map((role) => ({ label: ROLE_LABELS[role], value: role }))

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
}

type CreateCourseValues = {
  code: string
  name: string
  category: string
  audience: Role[]
  required?: boolean
  validityMonths?: number
}

type ChapterValues = { title: string; content: string; order?: number }

type OptionValue = { key: string; text: string }

type QuestionValues = {
  type: 'single' | 'multiple' | 'judge'
  prompt: string
  options: OptionValue[]
  answer: string
  score?: number
}

export default function TrainingPage() {
  const courseActionRef = useRef<ActionType>()
  const [createCourseOpen, setCreateCourseOpen] = useState(false)
  const [chapterTarget, setChapterTarget] = useState<Course | null>(null)
  const [questionTarget, setQuestionTarget] = useState<Course | null>(null)
  const [courseDetail, setCourseDetail] = useState<Course | null>(null)
  const [sales, setSales] = useState<MerchantSales | null>(null)

  const reloadCourses = () => courseActionRef.current?.reload()

  const loadSales = useCallback(async () => {
    try {
      setSales(await api<MerchantSales>('/training/merchant/sales'))
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '加载学习档案失败')
    }
  }, [])

  useEffect(() => {
    void loadSales()
  }, [loadSales])

  const openCourseDetail = async (id: string) => {
    try {
      setCourseDetail(await api<Course>(`/training/courses/${id}`))
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '加载课程详情失败')
    }
  }

  const columns: ProColumns<Course>[] = [
    { title: '课程编码', dataIndex: 'code', width: 140, copyable: true },
    {
      title: '课程',
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
      title: '面向角色',
      dataIndex: 'audience',
      width: 200,
      render: (_, entity) => (
        <Space size={4} wrap>
          {entity.audience?.map((role) => (
            <Tag key={role} color="cyan">
              {ROLE_LABELS[role] ?? role}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '必修',
      dataIndex: 'required',
      width: 70,
      renderText: (value: boolean) => (value ? '必修' : '选修'),
    },
    { title: '有效期', dataIndex: 'validityMonths', width: 90, renderText: (v: number) => `${v} 个月` },
    {
      title: '章节 / 考题',
      width: 100,
      renderText: (_, entity) =>
        `${entity.chapters?.length ?? 0} 章 / ${entity.questions?.length ?? 0} 题`,
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
      width: 200,
      render: (_, entity) => [
        <a key="detail" onClick={() => void openCourseDetail(entity.id)}>
          详情
        </a>,
        <a key="chapter" onClick={() => setChapterTarget(entity)}>
          加章节
        </a>,
        <a key="question" onClick={() => setQuestionTarget(entity)}>
          加考题
        </a>,
      ],
    },
  ]

  const salesColumns: ProColumns<SalesRecord>[] = [
    {
      title: '学习人',
      width: 150,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <Text strong>{entity.user?.name ?? '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {entity.user?.phone ?? ''}
          </Text>
        </Space>
      ),
    },
    { title: '课程', width: 180, renderText: (_, entity) => entity.course?.name ?? '—' },
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
      title: '进度',
      dataIndex: 'progress',
      width: 90,
      renderText: (value: number) => `${value}%`,
    },
    {
      title: '考试成绩',
      dataIndex: 'examScore',
      width: 90,
      renderText: (value?: number | null) => (value ?? null) === null ? '—' : `${value} 分`,
    },
    { title: '考试次数', dataIndex: 'attemptCount', width: 90 },
    {
      title: '有效期至',
      dataIndex: 'expiresAt',
      width: 110,
      renderText: (value?: string | null) => (value ? value.slice(0, 10) : '—'),
    },
  ]

  return (
    <PageContainer
      header={{ title: '培训管理', subTitle: '课程建设与团队学习档案' }}
      content="创建课程并配置章节与考题（60 分及格，有效期按月计算）；下方展示销售团队学习档案与完成率。"
    >
      <ProTable<Course>
        scroll={{ x: 'max-content' }}
        rowKey="id"
        actionRef={courseActionRef}
        headerTitle="课程列表"
        columns={columns}
        search={false}
        options={{ reload: true, density: true, setting: true }}
        pagination={{ pageSize: 10 }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={() => setCreateCourseOpen(true)}>
            新建课程
          </Button>,
        ]}
        request={async () => {
          const data = await api<Course[]>('/training/courses')
          return { data, success: true }
        }}
      />

      <Card title="销售团队学习档案" style={{ marginTop: 16 }}>
        {sales ? (
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Statistic
                title="整体完成率（通过 / 全部记录）"
                value={sales.completionRate}
                suffix="%"
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="学习记录总数" value={sales.records.length} suffix="条" />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="待考试人数次"
                value={sales.failed?.length ?? 0}
                suffix="条"
                valueStyle={{ color: (sales.failed?.length ?? 0) > 0 ? 'var(--ant-color-warning)' : undefined }}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="30 天内到期"
                value={sales.expiring?.length ?? 0}
                suffix="条"
                valueStyle={{ color: (sales.expiring?.length ?? 0) > 0 ? 'var(--ant-color-error)' : undefined }}
              />
            </Col>
          </Row>
        ) : null}
        <div style={{ marginTop: 16 }}>
          <ProTable<SalesRecord>
            scroll={{ x: 'max-content' }}
            rowKey="id"
            size="small"
            columns={salesColumns}
            search={false}
            options={false}
            pagination={{ pageSize: 10 }}
            dataSource={sales?.records ?? []}
          />
        </div>
      </Card>

      <ModalForm<CreateCourseValues>
        title="新建课程"
        width={560}
        open={createCourseOpen}
        modalProps={{ onCancel: () => setCreateCourseOpen(false) }}
        onOpenChange={setCreateCourseOpen}
        initialValues={{ required: false, validityMonths: 12 }}
        onFinish={async (values) => {
          try {
            await api('/training/courses', {
              method: 'POST',
              body: JSON.stringify({
                code: values.code,
                name: values.name,
                category: values.category,
                audience: values.audience,
                required: values.required,
                validityMonths: values.validityMonths,
              }),
            })
            message.success('课程已创建，请继续添加章节与考题')
            setCreateCourseOpen(false)
            reloadCourses()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '创建失败')
            return false
          }
        }}
      >
        <ProFormText
          name="code"
          label="课程编码"
          placeholder="唯一编码，如 sales_basic"
          rules={[{ required: true, message: '请输入课程编码' }, { min: 2 }]}
        />
        <ProFormText
          name="name"
          label="课程名称"
          rules={[{ required: true, message: '请输入课程名称' }, { min: 2 }]}
        />
        <ProFormText
          name="category"
          label="分类"
          placeholder="如 入职培训 / 年度复训"
          rules={[{ required: true, message: '请输入分类' }]}
        />
        <ProFormCheckbox.Group
          name="audience"
          label="面向角色"
          options={AUDIENCE_OPTIONS}
          rules={[{ required: true, message: '请选择面向角色' }]}
        />
        <ProFormSwitch name="required" label="是否必修" />
        <ProFormDigit
          name="validityMonths"
          label="证书有效期（月）"
          min={1}
          fieldProps={{ precision: 0 }}
        />
      </ModalForm>

      <ModalForm<ChapterValues>
        title={`添加章节 · ${chapterTarget?.name ?? ''}`}
        width={560}
        open={Boolean(chapterTarget)}
        modalProps={{ onCancel: () => setChapterTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setChapterTarget(null)
        }}
        onFinish={async (values) => {
          if (!chapterTarget) return false
          try {
            await api(`/training/courses/${chapterTarget.id}/chapters`, {
              method: 'POST',
              body: JSON.stringify({
                title: values.title,
                content: values.content,
                order: values.order,
              }),
            })
            message.success('章节已添加')
            setChapterTarget(null)
            reloadCourses()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '添加失败')
            return false
          }
        }}
      >
        <ProFormText
          name="title"
          label="章节标题"
          rules={[{ required: true, message: '请输入章节标题' }]}
        />
        <ProFormTextArea
          name="content"
          label="章节内容"
          fieldProps={{ rows: 6 }}
          rules={[{ required: true, message: '请输入章节内容' }]}
        />
        <ProFormDigit name="order" label="排序（可选，越小越靠前）" fieldProps={{ precision: 0 }} />
      </ModalForm>

      <ModalForm<QuestionValues>
        title={`添加考题 · ${questionTarget?.name ?? ''}`}
        width={600}
        open={Boolean(questionTarget)}
        modalProps={{ onCancel: () => setQuestionTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setQuestionTarget(null)
        }}
        initialValues={{ type: 'single', options: [{ key: 'A', text: '' }] }}
        onFinish={async (values) => {
          if (!questionTarget) return false
          const trimmed = values.answer.trim()
          if (!trimmed) {
            message.error('请填写正确答案')
            return false
          }
          try {
            await api(`/training/courses/${questionTarget.id}/questions`, {
              method: 'POST',
              body: JSON.stringify({
                type: values.type,
                prompt: values.prompt,
                options: values.options,
                answer:
                  values.type === 'multiple'
                    ? trimmed.split(/[,，\s]+/).filter(Boolean)
                    : trimmed,
                score: values.score,
              }),
            })
            message.success('考题已添加')
            setQuestionTarget(null)
            reloadCourses()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '添加失败')
            return false
          }
        }}
      >
        <ProFormRadio.Group
          name="type"
          label="题型"
          options={[
            { label: '单选题', value: 'single' },
            { label: '多选题', value: 'multiple' },
            { label: '判断题', value: 'judge' },
          ]}
          rules={[{ required: true }]}
        />
        <ProFormTextArea
          name="prompt"
          label="题干"
          fieldProps={{ rows: 2 }}
          rules={[{ required: true, message: '请输入题干' }]}
        />
        <ProFormList<OptionValue>
          name="options"
          label="选项（key 填 A/B/C/D，判断题可只留 对/错 两项）"
          min={2}
          max={6}
          creatorButtonProps={{ creatorButtonText: '添加选项' }}
        >
          <Space align="baseline">
            <ProFormText name="key" placeholder="A" width="xs" rules={[{ required: true, message: '填 key' }]} />
            <ProFormText name="text" placeholder="选项内容" width="md" rules={[{ required: true, message: '填内容' }]} />
          </Space>
        </ProFormList>
        <ProFormText
          name="answer"
          label="正确答案"
          extra="单选/判断填选项 key（判断题可填对/错选项的 key）；多选多个 key 用英文逗号分隔，如 A,C"
          rules={[{ required: true, message: '请填写正确答案' }]}
        />
        <ProFormDigit name="score" label="分值（可选，默认 10）" min={1} fieldProps={{ precision: 0 }} />
      </ModalForm>

      <Drawer
        width={560}
        open={Boolean(courseDetail)}
        onClose={() => setCourseDetail(null)}
        title={courseDetail ? `课程详情 · ${courseDetail.name}` : '课程详情'}
      >
        {courseDetail ? (
          <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
            <Descriptions.Item label="编码">{courseDetail.code}</Descriptions.Item>
            <Descriptions.Item label="分类">{courseDetail.category}</Descriptions.Item>
            <Descriptions.Item label="面向角色" span={2}>
              {courseDetail.audience?.map((role) => ROLE_LABELS[role] ?? role).join('、')}
            </Descriptions.Item>
            <Descriptions.Item label="必修">
              {courseDetail.required ? '必修' : '选修'}
            </Descriptions.Item>
            <Descriptions.Item label="有效期">{`${courseDetail.validityMonths} 个月`}</Descriptions.Item>
            <Descriptions.Item label="章节" span={2}>
              {courseDetail.chapters?.length
                ? courseDetail.chapters.map((chapter) => (
                    <Tag key={chapter.id}>
                      {chapter.order}. {chapter.title}
                    </Tag>
                  ))
                : '暂无章节'}
            </Descriptions.Item>
            <Descriptions.Item label="考题" span={2}>
              {courseDetail.questions?.length
                ? courseDetail.questions.map((question) => (
                    <Tag key={question.id}>
                      {QUESTION_TYPE_LABELS[question.type] ?? question.type} · {question.prompt}（
                      {question.score} 分）
                    </Tag>
                  ))
                : '暂无考题'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </PageContainer>
  )
}
