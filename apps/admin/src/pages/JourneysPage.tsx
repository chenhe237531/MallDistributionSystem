import { useRef, useState } from 'react'
import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Modal,
  Space,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import {
  BOWEL_PREP_STATUS_LABELS,
  BOWEL_PREP_STATUS_TONES,
  DOSING_SCHEME_LABELS,
  JOURNEY_PHASE_LABELS,
  JOURNEY_STATUS_LABELS,
  JOURNEY_STATUS_TONES,
  PUSH_SLOT_LABELS,
  PUSH_TASK_STATUS_LABELS,
  formatShanghaiDate,
  formatShanghaiDateTime,
  statusLabel,
  type DosingSchemeKey,
  type JourneyPhaseKey,
} from '@mall/shared'
import { listTableProps } from '../components/list'
import { api } from '../lib/api'

const { Text } = Typography

type Customer = { id: string; name: string; phone: string }

type Journey = {
  id: string
  journeyNo: string
  orderId: string
  customerId: string
  merchantId: string
  status: string
  bowelPrepStatus: string
  transplantDate: string | null
  dayOffset: number | null
  dayOffsetLabel: string | null
  phase: JourneyPhaseKey
  dosingScheme: DosingSchemeKey
  pauseReason?: string | null
  createdAt: string
  customer?: Customer | null
  bowelPrep?: {
    path?: string | null
    selfDrugName?: string | null
    selfNote?: string | null
    readyAt?: string | null
    readyBy?: string | null
    orderId?: string | null
  } | null
}

type Task = {
  id: string
  dayOffsetLabel: string
  slot: 'morning' | 'noon' | 'evening'
  scheduledAt: string
  title: string
  body: string
  status: string
  skipReason?: string | null
  sentAt?: string | null
}

type JourneyDetail = Journey & { timeline: Task[] }

const TASK_COLORS: Record<string, string> = {
  sent: 'green',
  pending: 'blue',
  skipped: 'gray',
  failed: 'red',
}

const STATUS_VALUE_ENUM = Object.fromEntries(
  Object.entries(JOURNEY_STATUS_LABELS).map(([value, label]) => [value, { text: label }]),
)
const PREP_VALUE_ENUM = Object.fromEntries(
  Object.entries(BOWEL_PREP_STATUS_LABELS).map(([value, label]) => [value, { text: label }]),
)

function formatDate(value?: string | null): string {
  return formatShanghaiDate(value)
}

function formatDateTime(value?: string | null): string {
  return formatShanghaiDateTime(value)
}

export default function JourneysPage() {
  const actionRef = useRef<ActionType>()
  const [detail, setDetail] = useState<JourneyDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [dispatching, setDispatching] = useState(false)

  const reload = () => actionRef.current?.reload()

  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setLoadingDetail(true)
    try {
      setDetail(await api<JourneyDetail>(`/journeys/${id}`))
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '加载失败')
    } finally {
      setLoadingDetail(false)
    }
  }

  const cancelJourney = (row: Journey) => {
    Modal.confirm({
      title: `取消旅程 ${row.journeyNo}？`,
      content: '取消后未发送的推送将全部跳过，客户不再收到健康提醒。该操作会记入合规留痕。',
      okText: '确认取消',
      okButtonProps: { danger: true },
      cancelText: '返回',
      onOk: async () => {
        await api(`/journeys/${row.id}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ reason: '平台取消' }),
        })
        message.success('旅程已取消')
        reload()
      },
    })
  }

  const resend = async (journeyId: string, task: Task) => {
    try {
      await api(`/journeys/${journeyId}/push-tasks/${task.id}/resend`, { method: 'POST' })
      message.success('已重新入队，5 分钟内投递')
      await openDetail(journeyId)
      reload()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '补发失败')
    }
  }

  const dispatchNow = async () => {
    setDispatching(true)
    try {
      const result = await api<{ scanned: number; sent: number; skipped: number; failed: number }>(
        '/journeys/dispatch-now',
        { method: 'POST' },
      )
      message.success(
        `调度完成：扫描 ${result.scanned} 条，发送 ${result.sent} 条，跳过 ${result.skipped} 条，失败 ${result.failed} 条`,
      )
      reload()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '调度失败')
    } finally {
      setDispatching(false)
    }
  }

  const columns: ProColumns<Journey>[] = [
    {
      title: '旅程号',
      dataIndex: 'journeyNo',
      width: 150,
      copyable: true,
      render: (_, row) => (
        <a onClick={() => void openDetail(row.id)}>{row.journeyNo}</a>
      ),
    },
    {
      title: '客户',
      width: 150,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.customer?.name ?? row.customerId.slice(0, 8)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.customer?.phone ?? '—'}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: STATUS_VALUE_ENUM,
      render: (_, row) => (
        <Tag color={JOURNEY_STATUS_TONES[row.status] === 'primary' ? 'blue' : undefined}>
          {statusLabel(JOURNEY_STATUS_LABELS, row.status)}
        </Tag>
      ),
    },
    {
      title: '阶段',
      width: 130,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>{JOURNEY_PHASE_LABELS[row.phase] ?? row.phase}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.dayOffsetLabel ?? '未排期'}
          </Text>
        </Space>
      ),
    },
    {
      title: '移植日',
      dataIndex: 'transplantDate',
      width: 110,
      renderText: (_, row) => formatDate(row.transplantDate),
    },
    {
      title: '服药方案',
      dataIndex: 'dosingScheme',
      width: 130,
      renderText: (value) => DOSING_SCHEME_LABELS[value as DosingSchemeKey] ?? String(value),
    },
    {
      title: '清肠药',
      dataIndex: 'bowelPrepStatus',
      width: 120,
      valueEnum: PREP_VALUE_ENUM,
      render: (_, row) => {
        const tone = BOWEL_PREP_STATUS_TONES[row.bowelPrepStatus]
        const color =
          tone === 'danger' ? 'red' : tone === 'warning' ? 'orange' : tone === 'success' ? 'green' : undefined
        return (
          <Tag color={color}>{statusLabel(BOWEL_PREP_STATUS_LABELS, row.bowelPrepStatus)}</Tag>
        )
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      renderText: (value) => formatDateTime(value as string),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, row) => [
        <a key="detail" onClick={() => void openDetail(row.id)}>
          详情
        </a>,
        row.status !== 'cancelled' && row.status !== 'completed' ? (
          <a key="cancel" style={{ color: 'var(--ant-color-error)' }} onClick={() => cancelJourney(row)}>
            取消
          </a>
        ) : null,
      ],
    },
  ]

  return (
    <PageContainer
      header={{ title: '健康助手旅程', subTitle: '移植服务开通、推送与清肠药就绪跟进' }}
      content="移植服务订单支付成功即自动开通旅程；设置移植日后按早 07:30 / 中 12:00 / 晚 19:30 生成全量推送计划。清肠药未就绪会在 D-2 / D-1 升级提醒并预警商家。"
    >
      <ProTable<Journey>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        {...listTableProps('journeys')}
        search={{ labelWidth: 'auto' }}
        options={{ reload: true, density: true, setting: true }}
        toolBarRender={() => [
          <Button key="dispatch" loading={dispatching} onClick={() => void dispatchNow()}>
            立即调度推送
          </Button>,
        ]}
        request={async (params) => {
          const query = new URLSearchParams()
          if (params.status) {
            query.set('status', String(params.status))
          }
          if (params.bowelPrepStatus) {
            query.set('bowelPrepStatus', String(params.bowelPrepStatus))
          }
          const data = await api<Journey[]>(
            `/journeys${query.toString() ? `?${query.toString()}` : ''}`,
          )
          return { data, success: true }
        }}
      />

      <Drawer
        title={detail ? `旅程 ${detail.journeyNo}` : '旅程详情'}
        width={620}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        destroyOnHidden
      >
        {loadingDetail || !detail ? (
          <Empty description={loadingDetail ? '加载中…' : '暂无数据'} />
        ) : (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="客户">
                {detail.customer?.name ?? '—'} {detail.customer?.phone ?? ''}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {statusLabel(JOURNEY_STATUS_LABELS, detail.status)}
              </Descriptions.Item>
              <Descriptions.Item label="阶段">
                {JOURNEY_PHASE_LABELS[detail.phase] ?? detail.phase}
                {detail.dayOffsetLabel ? ` · ${detail.dayOffsetLabel}` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="移植日">
                {formatDate(detail.transplantDate)}
              </Descriptions.Item>
              <Descriptions.Item label="服药方案">
                {DOSING_SCHEME_LABELS[detail.dosingScheme]}
              </Descriptions.Item>
              <Descriptions.Item label="清肠药">
                {statusLabel(BOWEL_PREP_STATUS_LABELS, detail.bowelPrepStatus)}
                {detail.bowelPrep?.selfDrugName
                  ? ` · 自购 ${detail.bowelPrep.selfDrugName}`
                  : detail.bowelPrep?.readyBy
                    ? ` · 由${detail.bowelPrep.readyBy === 'merchant' ? '商家' : '客户'}确认`
                    : ''}
              </Descriptions.Item>
              {detail.pauseReason ? (
                <Descriptions.Item label="暂停原因">{detail.pauseReason}</Descriptions.Item>
              ) : null}
            </Descriptions>

            <Typography.Title level={5} style={{ marginTop: 20 }}>
              推送时间线（{detail.timeline.length} 条）
            </Typography.Title>
            <Timeline
              items={detail.timeline.map((task) => ({
                color: TASK_COLORS[task.status] ?? 'gray',
                children: (
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space size={6}>
                      <Tag>{task.dayOffsetLabel}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {PUSH_SLOT_LABELS[task.slot]} · {formatDateTime(task.scheduledAt)}
                      </Text>
                      <Tag color={TASK_COLORS[task.status]}>
                        {PUSH_TASK_STATUS_LABELS[task.status] ?? task.status}
                      </Tag>
                    </Space>
                    <Text strong>{task.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {task.body}
                    </Text>
                    {task.status !== 'sent' ? (
                      <Button
                        size="small"
                        type="link"
                        style={{ padding: 0 }}
                        onClick={() => void resend(detail.id, task)}
                      >
                        补发
                      </Button>
                    ) : null}
                  </Space>
                ),
              }))}
            />
          </>
        )}
      </Drawer>
    </PageContainer>
  )
}
