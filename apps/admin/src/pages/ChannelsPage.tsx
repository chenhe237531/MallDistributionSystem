import { useState } from 'react'
import { Alert, Button, Card, Col, Descriptions, Row, Space, Tag, Typography, message } from 'antd'
import { ModalForm, PageContainer, ProForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components'
import { api } from '../lib/api'

const { Text, Paragraph } = Typography

type ChannelResolveResult = {
  valid: boolean
  code?: string
  type?: string
  subjectName?: string
}

type ReissueResult = {
  previousChannelId: string
  channel: { id: string; code: string; type: string; status: string }
  frozenBoxCodes: number
}

const TYPE_LABELS: Record<string, string> = {
  platform: '平台渠道',
  merchant: '商家渠道',
  partner: '合伙人渠道',
}

export default function ChannelsPage() {
  const [resolveCode, setResolveCode] = useState('')
  const [resolveResult, setResolveResult] = useState<ChannelResolveResult | null>(null)
  const [resolveFailed, setResolveFailed] = useState('')

  const resolveChannel = async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return
    setResolveCode(trimmed)
    try {
      const result = await api<ChannelResolveResult>(`/channels/resolve/${encodeURIComponent(trimmed)}`)
      setResolveResult(result)
      setResolveFailed('')
    } catch (cause) {
      setResolveResult(null)
      setResolveFailed(cause instanceof Error ? cause.message : '查询失败')
    }
  }

  return (
    <PageContainer
      header={{ title: '渠道管理', subTitle: '渠道码查询与风控处置' }}
      content="按渠道码查询归属与有效性，对异常渠道执行停用、恢复或重发渠道码。"
    >
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="渠道码查询">
            <ProForm<{ code: string }>
              layout="horizontal"
              onFinish={async (values) => {
                await resolveChannel(values.code)
              }}
            >
              <ProFormText
                name="code"
                label="渠道码"
                placeholder="如 MXXXXXXXX"
                rules={[{ required: true, message: '请输入渠道码' }]}
              />
            </ProForm>
            {resolveFailed ? (
              <Alert type="error" showIcon message={resolveFailed} style={{ marginTop: 16 }} />
            ) : null}
            {resolveResult ? (
              resolveResult.valid || resolveResult.code ? (
                <Descriptions
                  column={1}
                  size="small"
                  bordered
                  style={{ marginTop: 16 }}
                  items={[
                    {
                      key: 'code',
                      label: '渠道码',
                      children: <Text copyable>{resolveResult.code ?? resolveCode}</Text>,
                    },
                    {
                      key: 'valid',
                      label: '状态',
                      children: resolveResult.valid ? (
                        <Tag color="green">有效</Tag>
                      ) : (
                        <Tag color="red">无效或已停用</Tag>
                      ),
                    },
                    {
                      key: 'type',
                      label: '类型',
                      children: resolveResult.type
                        ? (TYPE_LABELS[resolveResult.type] ?? resolveResult.type)
                        : '—',
                    },
                    {
                      key: 'subject',
                      label: '归属',
                      children: resolveResult.subjectName ?? '—',
                    },
                  ]}
                />
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="渠道码无效"
                  description="未查询到该渠道码或已停用。"
                  style={{ marginTop: 16 }}
                />
              )
            ) : null}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="渠道处置">
            <Paragraph type="secondary">
              停用、恢复需输入渠道 ID（后台数据库标识）；重发渠道码会生成新码并停用旧码，
              同时冻结该渠道下所有未激活盒码并补码。
            </Paragraph>
            <Space wrap>
              <ModalForm<{ channelId: string; reason?: string }>
                title="停用渠道"
                width={440}
                trigger={<Button danger>停用渠道</Button>}
                onFinish={async (values) => {
                  try {
                    await api(`/channels/${values.channelId.trim()}/disable`, {
                      method: 'POST',
                      body: JSON.stringify({ reason: values.reason || undefined }),
                    })
                    message.success('渠道已停用')
                    if (resolveCode) await resolveChannel(resolveCode)
                    return true
                  } catch (cause) {
                    message.error(cause instanceof Error ? cause.message : '操作失败')
                    return false
                  }
                }}
              >
                <ProFormText
                  name="channelId"
                  label="渠道 ID"
                  rules={[{ required: true, message: '请输入渠道 ID' }]}
                />
                <ProFormTextArea name="reason" label="停用原因" placeholder="选填" />
              </ModalForm>
              <ModalForm<{ channelId: string }>
                title="恢复渠道"
                width={420}
                trigger={<Button>恢复渠道</Button>}
                onFinish={async (values) => {
                  try {
                    await api(`/channels/${values.channelId.trim()}/resume`, { method: 'POST' })
                    message.success('渠道已恢复')
                    if (resolveCode) await resolveChannel(resolveCode)
                    return true
                  } catch (cause) {
                    message.error(cause instanceof Error ? cause.message : '操作失败')
                    return false
                  }
                }}
              >
                <ProFormText
                  name="channelId"
                  label="渠道 ID"
                  rules={[{ required: true, message: '请输入渠道 ID' }]}
                  extra="仅已停用或风控暂停的渠道可恢复"
                />
              </ModalForm>
              <ModalForm<{ channelId: string }>
                title="重发渠道码"
                width={440}
                trigger={<Button>重发渠道码</Button>}
                onFinish={async (values) => {
                  try {
                    const result = await api<ReissueResult>(
                      `/channels/${values.channelId.trim()}/reissue`,
                      { method: 'POST' },
                    )
                    message.success(
                      `已重发渠道码 ${result.channel.code}，冻结未激活盒码 ${result.frozenBoxCodes} 个`,
                    )
                    if (resolveCode) await resolveChannel(resolveCode)
                    return true
                  } catch (cause) {
                    message.error(cause instanceof Error ? cause.message : '操作失败')
                    return false
                  }
                }}
              >
                <ProFormText
                  name="channelId"
                  label="渠道 ID"
                  rules={[{ required: true, message: '请输入渠道 ID' }]}
                  extra="旧渠道码将停用，其未激活盒码会全部作废并补码"
                />
              </ModalForm>
            </Space>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  )
}
