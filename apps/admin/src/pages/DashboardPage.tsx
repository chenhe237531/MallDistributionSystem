import { useEffect, useState } from 'react'
import { Badge, Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd'
import { ROLE_LABELS, Role } from '@mall/shared'

const { Title, Paragraph, Text } = Typography

const MODULES = [
  '账号、组织与实名',
  '商品、供货价与批次',
  '盒码、渠道归属',
  '采购单与销售单',
  '样本激活与检测',
  '报告发布与可见性',
  'AI 解读与营养方案',
  '素材与模板',
  '两级佣金',
  '对账、票证与结清',
  '合同签署',
  '培训与学习档案',
  '商家与销售工作台',
  '合规留痕',
  '预付款账户',
  '通知与转发',
]

type Health = {
  status: string
  database: string
  service: string
  version: string
}

export default function DashboardPage() {
  const [health, setHealth] = useState<Health | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/health')
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body: Health) => setHealth(body))
      .catch(() => setFailed(true))
  }, [])

  return (
    <Row gutter={[16, 16]}>
      <Col span={16}>
        <Card>
          <Title level={3}>功能域导航</Title>
          <Paragraph>P0 全部功能域已落地，包含账号、交易、检测、佣金、对账、通知、留痕与风控。</Paragraph>
          <Row gutter={[12, 12]}>
            {MODULES.map((module) => (
              <Col key={module} span={8}>
                <Card size="small" hoverable>
                  <Space direction="vertical" size={2}>
                    <Text strong>{module}</Text>
                    <Tag color="green">已实现</Tag>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      </Col>
      <Col span={8}>
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <Card>
            <Statistic title="P0 功能域" value={16} suffix="个" />
          </Card>
          <Card title="角色体系">
            <Space wrap>
              {Object.values(Role).map((role) => (
                <Tag key={role} color="cyan">
                  {ROLE_LABELS[role]}
                </Tag>
              ))}
            </Space>
          </Card>
          <Card title="服务状态">
            {health ? (
              <Badge status="success" text="API / 数据库正常" />
            ) : failed ? (
              <Badge status="error" text="API 未连接" />
            ) : (
              <Badge status="processing" text="检查中" />
            )}
            <Space direction="vertical" style={{ marginTop: 12 }}>
              <Text>API：{health?.service ?? '—'}</Text>
              <Text>数据库：{health?.database ?? '—'}</Text>
              <Text>版本：{health?.version ?? '—'}</Text>
            </Space>
          </Card>
        </Space>
      </Col>
    </Row>
  )
}
