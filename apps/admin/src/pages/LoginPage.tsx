import { useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { Role } from '@mall/shared'
import { api, setToken } from '../lib/api'

const { Title, Paragraph, Text } = Typography

type LoginResponse = {
  token: string
  user: { id: string; name: string; phone: string; role: Role; status: string }
}

type Props = {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (values: { phone: string; password: string }) => {
    setLoading(true)
    setError('')
    try {
      const result = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      if (result.user.role !== Role.PLATFORM) {
        setError('该入口仅限平台运营账号')
        return
      }
      setToken(result.token)
      onLogin()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <Card style={{ width: 400 }}>
        <Title level={3}>商城-分销系统</Title>
        <Paragraph type="secondary">平台后台登录</Paragraph>
        {error ? <Alert type="error" message={error} style={{ marginBottom: 16 }} /> : null}
        <Form layout="vertical" onFinish={submit} initialValues={{ phone: '13800000000', password: 'Admin@123' }}>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input maxLength={11} />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登录
          </Button>
        </Form>
        <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
          本地种子账号：13800000000 / Admin@123
        </Text>
      </Card>
    </div>
  )
}
