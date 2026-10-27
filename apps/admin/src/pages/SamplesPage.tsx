import { useRef, useState } from 'react'
import { Descriptions, Drawer, Popconfirm, Space, Tag, Typography, message } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import {
  ModalForm,
  PageContainer,
  ProFormCheckbox,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components'
import { api } from '../lib/api'

const { Text } = Typography

type SampleEvent = {
  id: string
  type: string
  note?: string | null
  operatorId?: string | null
  createdAt: string
}

type Sample = {
  id: string
  sampleNo: string
  status: string
  samplingMethod: string
  abnormalReason?: string | null
  resampleCount: number
  receivedAt?: string | null
  createdAt: string
  boxCode?: { id: string; code: string } | null
  customer?: { id: string; name: string; phone: string; realName?: string | null } | null
  events?: SampleEvent[]
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  generated: { label: '待激活', color: 'default' },
  activated: { label: '已激活', color: 'blue' },
  pending_mail: { label: '待寄出', color: 'cyan' },
  in_transit: { label: '运输中', color: 'geekblue' },
  received_by_lab: { label: '实验室已收样', color: 'purple' },
  testing: { label: '检测中', color: 'processing' },
  report_generated: { label: '报告已生成', color: 'lime' },
  published: { label: '已发布', color: 'green' },
  abnormal: { label: '异常', color: 'orange' },
  voided: { label: '已作废', color: 'red' },
}

const EVENT_LABELS: Record<string, string> = {
  activated: '激活盒码',
  mailed: '登记寄出',
  received_by_lab: '实验室收样',
  abnormal_received: '收样异常',
  testing: '开始检测',
  abnormal: '登记异常',
  resample: '安排补采',
  report_published: '报告发布',
  voided: '样本作废',
}

type AbnormalValues = { reason: string }
type ResampleValues = { reason?: string }
type ReceiveValues = {
  checks: string[]
  note?: string
}

const RECEIVE_CHECKS = [
  { label: '盒码相符', value: 'boxCodeMatched' },
  { label: '采样时间符合要求', value: 'samplingTimeValid' },
  { label: '保存条件合格', value: 'storageConditionOk' },
  { label: '运输时长在限', value: 'transitWithinLimit' },
]

export default function SamplesPage() {
  const actionRef = useRef<ActionType>()
  const [abnormalTarget, setAbnormalTarget] = useState<Sample | null>(null)
  const [resampleTarget, setResampleTarget] = useState<Sample | null>(null)
  const [receiveTarget, setReceiveTarget] = useState<Sample | null>(null)
  const [detail, setDetail] = useState<Sample | null>(null)

  const reload = () => actionRef.current?.reload()

  const openDetail = async (id: string) => {
    try {
      setDetail(await api<Sample>(`/samples/${id}`))
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '加载失败')
    }
  }

  const startTesting = async (entity: Sample) => {
    try {
      await api(`/samples/${entity.id}/testing`, { method: 'POST' })
      message.success(`样本 ${entity.sampleNo} 已开始检测`)
      reload()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  const voidSample = async (entity: Sample) => {
    try {
      await api(`/samples/${entity.id}/void`, { method: 'POST' })
      message.success(`样本 ${entity.sampleNo} 已作废`)
      reload()
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  const columns: ProColumns<Sample>[] = [
    { title: '样本号', dataIndex: 'sampleNo', width: 160, copyable: true },
    {
      title: '盒码',
      width: 150,
      renderText: (_, entity) => entity.boxCode?.code ?? '—',
    },
    {
      title: '用户',
      width: 150,
      render: (_, entity) => (
        <Space direction="vertical" size={0}>
          <Text strong>{entity.customer?.realName || entity.customer?.name || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {entity.customer?.phone ?? ''}
          </Text>
        </Space>
      ),
    },
    { title: '采样方式', dataIndex: 'samplingMethod', width: 110 },
    {
      title: '补采次数',
      dataIndex: 'resampleCount',
      width: 90,
      renderText: (value: number) => `${value} / 2`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (_, entity) => {
        const meta = STATUS_META[entity.status] ?? { label: entity.status, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '异常原因',
      dataIndex: 'abnormalReason',
      ellipsis: true,
      renderText: (value?: string | null) => value ?? '—',
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
      width: 260,
      render: (_, entity) => [
        <a key="detail" onClick={() => void openDetail(entity.id)}>
          详情
        </a>,
        entity.status === 'in_transit' ? (
          <a key="receive" onClick={() => setReceiveTarget(entity)}>
            登记收样
          </a>
        ) : null,
        entity.status === 'received_by_lab' ? (
          <Popconfirm
            key="testing"
            title="确认开始检测？"
            onConfirm={() => void startTesting(entity)}
          >
            <a>开始检测</a>
          </Popconfirm>
        ) : null,
        entity.status !== 'published' && entity.status !== 'voided' ? (
          <a key="abnormal" onClick={() => setAbnormalTarget(entity)}>
            登记异常
          </a>
        ) : null,
        entity.status === 'abnormal' && entity.resampleCount < 2 ? (
          <a key="resample" onClick={() => setResampleTarget(entity)}>
            安排补采
          </a>
        ) : null,
        entity.status !== 'published' ? (
          <Popconfirm
            key="void"
            title="确认作废该样本？"
            description="作废后不可恢复，请谨慎操作"
            onConfirm={() => void voidSample(entity)}
          >
            <a style={{ color: 'var(--ant-color-error)' }}>作废</a>
          </Popconfirm>
        ) : null,
      ],
    },
  ]

  return (
    <PageContainer
      header={{ title: '样本检测', subTitle: '样本流转与实验室操作' }}
      content="跟踪样本寄送与检测进度，对运输中的样本登记收样并核对检查项，处理异常样本（登记异常、安排补采），必要时作废样本。"
    >
      <ProTable<Sample>
        scroll={{ x: 'max-content' }}
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        search={false}
        options={{ reload: true, density: true, setting: true }}
        pagination={{ pageSize: 10 }}
        request={async () => {
          const data = await api<Sample[]>('/samples')
          return { data, success: true }
        }}
      />

      <ModalForm<AbnormalValues>
        title={`登记异常 · ${abnormalTarget?.sampleNo ?? ''}`}
        width={460}
        open={Boolean(abnormalTarget)}
        modalProps={{ onCancel: () => setAbnormalTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setAbnormalTarget(null)
        }}
        onFinish={async (values) => {
          if (!abnormalTarget) return false
          try {
            await api(`/samples/${abnormalTarget.id}/abnormal`, {
              method: 'POST',
              body: JSON.stringify({ reason: values.reason }),
            })
            message.success('异常已登记')
            setAbnormalTarget(null)
            reload()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '操作失败')
            return false
          }
        }}
      >
        <ProFormTextArea
          name="reason"
          label="异常原因"
          placeholder="如：保存条件不合格 / 运输时长超限"
          fieldProps={{ rows: 3 }}
          rules={[{ required: true, message: '请填写异常原因' }]}
        />
      </ModalForm>

      <ModalForm<ResampleValues>
        title={`安排补采 · ${resampleTarget?.sampleNo ?? ''}`}
        width={460}
        open={Boolean(resampleTarget)}
        modalProps={{ onCancel: () => setResampleTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setResampleTarget(null)
        }}
        onFinish={async (values) => {
          if (!resampleTarget) return false
          try {
            const result = await api<{ boxCode?: { code: string } }>(
              `/samples/${resampleTarget.id}/resample`,
              {
                method: 'POST',
                body: JSON.stringify({ reason: values.reason }),
              },
            )
            message.success(
              `已生成补采盒码 ${result.boxCode?.code ?? ''}，请通知用户重新采样寄出`,
            )
            setResampleTarget(null)
            reload()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '操作失败')
            return false
          }
        }}
      >
        <ProFormTextArea
          name="reason"
          label="补采原因（可选）"
          placeholder="说明为何需要补采"
          fieldProps={{ rows: 3 }}
          extra={`当前已补采 ${resampleTarget?.resampleCount ?? 0} 次，上限 2 次`}
        />
      </ModalForm>

      <ModalForm<ReceiveValues>
        title={`登记收样 · ${receiveTarget?.sampleNo ?? ''}`}
        width={480}
        open={Boolean(receiveTarget)}
        modalProps={{ onCancel: () => setReceiveTarget(null) }}
        onOpenChange={(open) => {
          if (!open) setReceiveTarget(null)
        }}
        initialValues={{ checks: RECEIVE_CHECKS.map((item) => item.value) }}
        onFinish={async (values) => {
          if (!receiveTarget) return false
          try {
            const result = await api<Sample>(`/samples/${receiveTarget.id}/receive`, {
              method: 'POST',
              body: JSON.stringify({
                boxCodeMatched: values.checks.includes('boxCodeMatched'),
                samplingTimeValid: values.checks.includes('samplingTimeValid'),
                storageConditionOk: values.checks.includes('storageConditionOk'),
                transitWithinLimit: values.checks.includes('transitWithinLimit'),
                note: values.note,
              }),
            })
            message.success(
              result.status === 'abnormal'
                ? '收样检查不合格，已登记异常，请安排补采或作废'
                : `样本 ${receiveTarget.sampleNo} 收样登记成功，可开始检测`,
            )
            setReceiveTarget(null)
            reload()
            return true
          } catch (cause) {
            message.error(cause instanceof Error ? cause.message : '操作失败')
            return false
          }
        }}
      >
        <ProFormCheckbox.Group
          name="checks"
          label="收样检查项（勾选表示合格）"
          options={RECEIVE_CHECKS}
          rules={[{ required: true, message: '请核对检查项' }]}
        />
        <ProFormTextArea
          name="note"
          label="备注（可选）"
          placeholder="如快递单号、外观情况等"
          fieldProps={{ rows: 2 }}
        />
      </ModalForm>

      <Drawer
        width={560}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `样本详情 · ${detail.sampleNo}` : '样本详情'}
      >
        {detail ? (
          <Space direction="vertical" size={16} style={{ display: 'flex' }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_META[detail.status]?.color ?? 'default'}>
                  {STATUS_META[detail.status]?.label ?? detail.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="盒码">{detail.boxCode?.code ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="用户">
                {detail.customer?.realName || detail.customer?.name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="手机号">{detail.customer?.phone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="采样方式">{detail.samplingMethod}</Descriptions.Item>
              <Descriptions.Item label="补采次数">{`${detail.resampleCount} / 2`}</Descriptions.Item>
              <Descriptions.Item label="收样时间">
                {detail.receivedAt ? detail.receivedAt.slice(0, 19).replace('T', ' ') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {detail.createdAt.slice(0, 19).replace('T', ' ')}
              </Descriptions.Item>
              {detail.abnormalReason ? (
                <Descriptions.Item label="异常原因" span={2}>
                  {detail.abnormalReason}
                </Descriptions.Item>
              ) : null}
            </Descriptions>
            <Text strong>流转记录</Text>
            <ProTable<SampleEvent>
              scroll={{ x: 'max-content' }}
              rowKey="id"
              size="small"
              search={false}
              options={false}
              pagination={false}
              columns={[
                {
                  title: '事件',
                  dataIndex: 'type',
                  width: 120,
                  renderText: (value: string) => EVENT_LABELS[value] ?? value,
                },
                { title: '备注', dataIndex: 'note', renderText: (value?: string) => value ?? '—' },
                {
                  title: '时间',
                  dataIndex: 'createdAt',
                  width: 160,
                  renderText: (value: string) => value.slice(0, 19).replace('T', ' '),
                },
              ]}
              dataSource={detail.events ?? []}
            />
          </Space>
        ) : null}
      </Drawer>
    </PageContainer>
  )
}
