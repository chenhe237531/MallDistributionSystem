import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Button, Layout, Menu, Space, Typography } from 'antd'
import { clearToken, getToken } from './lib/api'
import AccountsPage from './pages/AccountsPage'
import AlertsPage from './pages/AlertsPage'
import AuditPage from './pages/AuditPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import OperationsPage from './pages/OperationsPage'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

function Shell() {
  const [token, setTokenState] = useState(getToken())
  const navigate = useNavigate()
  const location = useLocation()

  if (!token) {
    return <LoginPage onLogin={() => setTokenState(getToken())} />
  }

  const logout = () => {
    clearToken()
    setTokenState('')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#0f172a', display: 'flex', alignItems: 'center', gap: 24 }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          商城-分销系统
        </Title>
        <Text style={{ color: '#94a3b8' }}>平台后台 · P0</Text>
        <Space style={{ marginLeft: 'auto' }}>
          <Button ghost size="small" onClick={logout}>
            退出登录
          </Button>
        </Space>
      </Header>
      <Layout>
        <Sider width={220} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            onClick={({ key }) => navigate(key)}
            items={[
              { key: '/', label: '总览' },
              { key: '/accounts', label: '账号与资质' },
              { key: '/operations', label: '报告待转发' },
              { key: '/alerts', label: '风控告警' },
              { key: '/audit', label: '合规留痕' },
            ]}
          />
        </Sider>
        <Content style={{ padding: 24 }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
