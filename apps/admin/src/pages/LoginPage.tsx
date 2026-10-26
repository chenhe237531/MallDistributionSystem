import { useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { Role } from '@mall/shared'
import { api, setSessionUser, setToken } from '../lib/api'
import logo from '../assets/logo.png'

const { Title, Paragraph, Text } = Typography

type LoginResponse = {
  token: string
  user: { id: string; name: string; phone: string; role: Role; status: string }
}

type DemoAccount = {
  role: Role
  label: string
  phone: string
  password: string
  hint: string
}

/** 演示账号：后台业务模块仅平台运营可进入，其他角色登录后展示权限提示 */
const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: Role.PLATFORM, label: '平台运营', phone: '13800000000', password: 'Admin@123', hint: '后台全量模块' },
  { role: Role.MERCHANT, label: '商家', phone: '13900000001', password: 'Merchant@123', hint: '商家端 :10086' },
  { role: Role.PARTNER, label: '合伙人', phone: '13900000010', password: 'Partner@123', hint: '仅演示登录' },
  { role: Role.SALES, label: '销售', phone: '13900000002', password: 'Sales@123', hint: '商家端 :10086' },
  { role: Role.SUPPLIER, label: '供应商', phone: '13900000009', password: 'Supplier@123', hint: '仅演示登录' },
  { role: Role.LAB, label: '实验室', phone: '13900000004', password: 'Lab@123', hint: '仅演示登录' },
  { role: Role.NUTRITIONIST, label: '营养师', phone: '13900000005', password: 'Nutritionist@123', hint: '仅演示登录' },
]

type Props = {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: Props) {
  const [form] = Form.useForm<{ phone: string; password: string }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fillDemo = (account: DemoAccount) => {
    form.setFieldsValue({ phone: account.phone, password: account.password })
    setError('')
  }

  const submit = async (values: { phone: string; password: string }) => {
    setLoading(true)
    setError('')
    try {
      const result = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      if (result.user.role === Role.CUSTOMER) {
        setError('C 端用户请使用客户端入口登录')
        return
      }
      setToken(result.token)
      setSessionUser({
        id: result.user.id,
        name: result.user.name,
        phone: result.user.phone,
        role: result.user.role,
      })
      onLogin()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <img className="login-logo" src={logo} alt="百英诺科技" />
        <Title level={3}>商城-分销系统</Title>
        <Paragraph type="secondary">平台后台登录</Paragraph>
        {error ? <Alert type="error" message={error} style={{ marginBottom: 16 }} /> : null}
        <Form form={form} layout="vertical" onFinish={submit}>
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
        <div className="login-demo">
          <Text type="secondary" className="login-demo-title">
            演示账号 · 点击角色自动填充
          </Text>
          <div className="login-demo-grid">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.phone}
                type="button"
                className="login-demo-role"
                onClick={() => fillDemo(account)}
              >
                <span className="login-demo-role-head">
                  <span className="login-demo-role-name">{account.label}</span>
                  {account.role !== Role.PLATFORM ? (
                    <span className="login-demo-role-badge">演示</span>
                  ) : null}
                </span>
                <span className="login-demo-role-account">
                  {account.phone} / {account.password}
                </span>
                <span className="login-demo-role-hint">{account.hint}</span>
              </button>
            ))}
          </div>
          <Text type="secondary" className="login-demo-note">
            后台业务模块仅平台运营可进入，其他角色登录后显示权限提示。
          </Text>
        </div>
      </Card>
    </div>
  )
}
