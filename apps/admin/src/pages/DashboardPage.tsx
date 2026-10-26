import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Col, Row, Space, Spin, Statistic, Tag, Typography } from 'antd'
import { PageContainer } from '@ant-design/pro-components'
import { ROLE_LABELS, Role } from '@mall/shared'
import { api } from '../lib/api'

const { Title, Paragraph, Text } = Typography

type Account = { id: string; status: string; primaryRole: Role }
type Alert = { id: string; status: string }
type ReportTask = { id: string; status: string }
type Reminder = { id: string; status?: string }

type Health = {
  status: string
  database: string
  service: string
  version: string
}

const QUICK_LINKS = [
  { path: '/orders', label: '销售订单', desc: '订单全生命周期管理' },
  { path: '/statements', label: '对账中心', desc: '对账、差异与结算' },
  { path: '/commissions', label: '佣金管理', desc: '规则与确认入账' },
  { path: '/accounts', label: '账号与资质', desc: '开户与资质审核' },
  { path: '/products', label: '商品与库存', desc: '定价审核与批次' },
  { path: '/alerts', label: '风控告警', desc: '告警处理' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const [health, setHealth] = useState<Health | null>(null)
  const [healthLoaded, setHealthLoaded] = useState(false)
  const [stats, setStats] = useState<{
    accountsPending: number
    accountsActive: number
    tasksOpen: number
    alertsOpen: number
  } | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body: Health) => setHealth(body))
      .catch(() => setHealth(null))
      .finally(() => setHealthLoaded(true))

    void (async () => {
      try {
        const [accounts, alerts, tasks] = await Promise.all([
          api<Account[]>('/accounts'),
          api<Alert[]>('/alerts'),
          api<ReportTask[]>('/notifications/report-tasks'),
        ])
        setStats({
          accountsPending: accounts.filter((item) => item.status === 'pending').length,
          accountsActive: accounts.filter((item) => item.status === 'active').length,
          alertsOpen: alerts.filter((item) => item.status !== 'resolved').length,
          tasksOpen: tasks.filter((item) => item.status === 'pending' || item.status === 'overdue')
            .length,
        })
      } catch {
        setStats({ accountsPending: 0, accountsActive: 0, tasksOpen: 0, alertsOpen: 0 })
      }
    })()
  }, [])

  const go = (path: string) => {
    navigate(path)
  }

  return (
    <PageContainer header={{ title: '运营总览' }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Text type="secondary">平台核心待办与关键指标，点击卡片直达对应业务模块。</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={!stats}>
            <Statistic
              title="待审核账号"
              value={stats?.accountsPending ?? 0}
              suffix="个"
              valueStyle={{ color: (stats?.accountsPending ?? 0) > 0 ? 'var(--ant-color-warning)' : undefined }}
            />
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => go('/accounts')}>
              前往审核 →
            </Button>
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={!stats}>
            <Statistic title="启用中账号" value={stats?.accountsActive ?? 0} suffix="个" />
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => go('/accounts')}>
              查看账号 →
            </Button>
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={!stats}>
            <Statistic
              title="待转发报告"
              value={stats?.tasksOpen ?? 0}
              suffix="单"
              valueStyle={{ color: (stats?.tasksOpen ?? 0) > 0 ? 'var(--ant-color-warning)' : undefined }}
            />
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => go('/operations')}>
              前往转发 →
            </Button>
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={!stats}>
            <Statistic
              title="未处理告警"
              value={stats?.alertsOpen ?? 0}
              suffix="条"
              valueStyle={{ color: (stats?.alertsOpen ?? 0) > 0 ? 'var(--ant-color-error)' : undefined }}
            />
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => go('/alerts')}>
              前往处理 →
            </Button>
          </Card>
        </Col>

        <Col span={16}>
          <Card title="快捷入口">
            <Row gutter={[12, 12]}>
              {QUICK_LINKS.map((link) => (
                <Col key={link.path} span={8}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => go(link.path)}
                    styles={{ body: { padding: 16 } }}
                  >
                    <Space direction="vertical" size={2}>
                      <Text strong>{link.label}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {link.desc}
                      </Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
          <Card title="角色体系" style={{ marginTop: 16 }}>
            <Space wrap>
              {Object.values(Role).map((role) => (
                <Tag key={role} color="cyan">
                  {ROLE_LABELS[role]}
                </Tag>
              ))}
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="服务状态">
            {!healthLoaded ? (
              <Spin />
            ) : health ? (
              <Badge status="success" text="API / 数据库正常" />
            ) : (
              <Badge status="error" text="API 未连接" />
            )}
            <Space direction="vertical" style={{ marginTop: 12 }}>
              <Text>服务：{health?.service ?? '—'}</Text>
              <Text>数据库：{health?.database ?? '—'}</Text>
              <Text>版本：{health?.version ?? '—'}</Text>
            </Space>
          </Card>
          <Card title="关于本系统" style={{ marginTop: 16 }}>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              覆盖账号组织、商品批次、盒码渠道、采购销售、样本检测、报告发布、AI 解读与营养方案、
              素材模板、两级佣金、对账票证、合同签署、培训档案、双端工作台、合规留痕与预付款。
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  )
}
