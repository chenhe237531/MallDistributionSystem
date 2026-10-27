import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { Alert, Button, Card, Grid, Result, Space, Spin, Tag, Typography } from 'antd'
import {
  AuditOutlined,
  BankOutlined,
  BarcodeOutlined,
  BellOutlined,
  BookOutlined,
  BoxPlotOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  HeartOutlined,
  PayCircleOutlined,
  ReadOutlined,
  ReconciliationOutlined,
  SafetyCertificateOutlined,
  ShoppingOutlined,
  SolutionOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { ProLayout } from '@ant-design/pro-components'
import type { ProLayoutProps } from '@ant-design/pro-components'
import { ROLE_LABELS, Role } from '@mall/shared'
import {
  api,
  clearSessionUser,
  clearToken,
  getSessionUser,
  getToken,
  setSessionUser,
  type SessionUser,
} from './lib/api'
import { proLayoutToken } from './theme'
import AccountsPage from './pages/AccountsPage'
import AlertsPage from './pages/AlertsPage'
import AuditPage from './pages/AuditPage'
import BoxCodesPage from './pages/BoxCodesPage'
import ChannelsPage from './pages/ChannelsPage'
import CommissionsPage from './pages/CommissionsPage'
import ContractsPage from './pages/ContractsPage'
import DashboardPage from './pages/DashboardPage'
import InterpretationsPage from './pages/InterpretationsPage'
import JourneysPage from './pages/JourneysPage'
import LoginPage from './pages/LoginPage'
import MaterialsPage from './pages/MaterialsPage'
import OperationsPage from './pages/OperationsPage'
import OrdersPage from './pages/OrdersPage'
import PrepaidPage from './pages/PrepaidPage'
import ProcurementPage from './pages/ProcurementPage'
import ProductsPage from './pages/ProductsPage'
import RemindersPage from './pages/RemindersPage'
import ReportsPage from './pages/ReportsPage'
import SamplesPage from './pages/SamplesPage'
import StatementsPage from './pages/StatementsPage'
import TrainingPage from './pages/TrainingPage'

const MENU_ROUTE: ProLayoutProps['route'] = {
  path: '/',
  routes: [
    { path: '/', name: '总览', icon: <DashboardOutlined /> },
    {
      path: '/operations-group',
      name: '运营管理',
      icon: <ShoppingOutlined />,
      routes: [
        { path: '/orders', name: '销售订单', icon: <ShoppingOutlined /> },
        { path: '/journeys', name: '健康助手', icon: <HeartOutlined /> },
        { path: '/procurement', name: '采购单', icon: <BoxPlotOutlined /> },
        { path: '/box-codes', name: '盒码管理', icon: <BarcodeOutlined /> },
        { path: '/channels', name: '渠道管理', icon: <ThunderboltOutlined /> },
      ],
    },
    {
      path: '/finance-group',
      name: '交易与资金',
      icon: <PayCircleOutlined />,
      routes: [
        { path: '/commissions', name: '佣金管理', icon: <PayCircleOutlined /> },
        { path: '/statements', name: '对账中心', icon: <ReconciliationOutlined /> },
        { path: '/prepaid', name: '预付款', icon: <WalletOutlined /> },
      ],
    },
    {
      path: '/product-group',
      name: '商品与检测',
      icon: <FileDoneOutlined />,
      routes: [
        { path: '/products', name: '商品与库存', icon: <ShoppingOutlined /> },
        { path: '/samples', name: '样本检测', icon: <BankOutlined /> },
        { path: '/reports', name: '报告管理', icon: <FileTextOutlined /> },
        { path: '/interpretations', name: 'AI 解读', icon: <ReadOutlined /> },
      ],
    },
    {
      path: '/ecosystem-group',
      name: '生态管理',
      icon: <TeamOutlined />,
      routes: [
        { path: '/accounts', name: '账号与资质', icon: <TeamOutlined /> },
        { path: '/contracts', name: '合同管理', icon: <FileProtectOutlined /> },
        { path: '/materials', name: '素材模板', icon: <SolutionOutlined /> },
        { path: '/training', name: '培训管理', icon: <BookOutlined /> },
      ],
    },
    {
      path: '/risk-group',
      name: '风控与合规',
      icon: <SafetyCertificateOutlined />,
      routes: [
        { path: '/operations', name: '报告待转发', icon: <BellOutlined /> },
        { path: '/alerts', name: '风控告警', icon: <SafetyCertificateOutlined /> },
        { path: '/reminders', name: '超时提醒', icon: <BellOutlined /> },
        { path: '/audit', name: '合规留痕', icon: <AuditOutlined /> },
      ],
    },
  ],
}

/** FR-A1 / FR-X：直接访问不存在或无权限的 URL 时显示 403 空态，不静默跳转。 */
function ForbiddenPage() {
  return (
    <Result
      status="403"
      title="403"
      subTitle="抱歉，该页面不存在或当前账号无权访问。"
      extra={
        <Space>
          <Button type="primary" onClick={() => window.history.back()}>
            返回上一页
          </Button>
          <Link to="/">
            <Button>回到总览</Button>
          </Link>
        </Space>
      }
    />
  )
}

/** 非平台角色的推荐业务入口：后台仅平台运营可进入业务模块 */
const MERCHANT_H5_URL = import.meta.env.VITE_MERCHANT_H5_URL ?? 'http://localhost:10086'
const CUSTOMER_H5_URL = import.meta.env.VITE_CUSTOMER_H5_URL ?? 'http://localhost:10087'
const ROLE_ENTRY: Partial<Record<Role, { label: string; url?: string }>> = {
  [Role.MERCHANT]: MERCHANT_H5_URL
    ? { label: '商家端 H5', url: MERCHANT_H5_URL }
    : { label: '商家端（暂未开放独立入口）' },
  [Role.SALES]: MERCHANT_H5_URL
    ? { label: '商家端 H5', url: MERCHANT_H5_URL }
    : { label: '商家端（暂未开放独立入口）' },
  [Role.CUSTOMER]: CUSTOMER_H5_URL
    ? { label: '客户端 H5', url: CUSTOMER_H5_URL }
    : { label: '客户端（暂未开放独立入口）' },
  [Role.PARTNER]: { label: '合伙人端（规划中，暂未开放）' },
  [Role.SUPPLIER]: { label: '供应商端（规划中，暂未开放）' },
  [Role.LAB]: { label: '实验室端（规划中，暂未开放）' },
  [Role.NUTRITIONIST]: { label: '营养师端（规划中，暂未开放）' },
}

/** 非平台角色登录后展示权限提示，不进入平台业务菜单 */
function RoleNoticePage({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const label = ROLE_LABELS[user.role] ?? user.role
  const entry = ROLE_ENTRY[user.role]
  return (
    <div className="login-page">
      <Card className="role-notice-card">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space align="center">
            <Tag color="blue">{label}</Tag>
            <Typography.Title level={4} style={{ margin: 0 }}>
              后台权限受限
            </Typography.Title>
          </Space>
          <Alert
            type="warning"
            showIcon
            message="当前角色无法进入后台业务模块"
            description={`后台管理台仅向平台运营开放。当前登录账号：${user.name}（${user.phone}），角色：${label}。`}
          />
          <div className="role-notice-entry">
            <Typography.Text type="secondary">该角色请使用</Typography.Text>
            <Typography.Text strong>{entry?.label ?? '对应业务端'}</Typography.Text>
          </div>
          <Space wrap>
            <Button type="primary" onClick={onLogout}>
              退出并返回登录
            </Button>
            {entry?.url ? (
              <Button href={entry.url} target="_blank">
                前往{entry.label}
              </Button>
            ) : null}
          </Space>
        </Space>
      </Card>
    </div>
  )
}

function Shell() {
  const [token, setTokenState] = useState(getToken())
  const [user, setUserState] = useState<SessionUser | null>(getSessionUser())
  const location = useLocation()
  // H5 兼容：<768px 视为移动端；首帧 screens 未就绪时按视口宽度兜底，避免桌面布局闪烁
  const screens = Grid.useBreakpoint()
  const isMobile = screens.md === false || (screens.md === undefined && window.innerWidth < 768)

  useEffect(() => {
    if (!token || user) {
      return
    }
    let cancelled = false
    void api<{ id: string; name: string; phone: string; primaryRole: Role }>('/auth/me')
      .then((me) => {
        if (cancelled) {
          return
        }
        const session: SessionUser = {
          id: me.id,
          name: me.name,
          phone: me.phone,
          role: me.primaryRole,
        }
        setSessionUser(session)
        setUserState(session)
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        clearToken()
        clearSessionUser()
        setTokenState('')
      })
    return () => {
      cancelled = true
    }
  }, [token, user])

  const logout = () => {
    clearToken()
    clearSessionUser()
    setUserState(null)
    setTokenState('')
  }

  if (!token) {
    return (
      <LoginPage
        onLogin={() => {
          setUserState(getSessionUser())
          setTokenState(getToken())
        }}
      />
    )
  }

  if (!user) {
    return (
      <div className="login-page">
        <Spin size="large" />
      </div>
    )
  }

  if (user.role !== Role.PLATFORM) {
    return <RoleNoticePage user={user} onLogout={logout} />
  }

  return (
    <ProLayout
      title="商城-分销系统"
      layout="mix"
      fixSiderbar
      fixedHeader
      contentWidth="Fluid"
      location={{ pathname: location.pathname }}
      route={MENU_ROUTE}
      /* H5：小屏收起时整体隐藏侧栏（避免 48px 栏遮挡内容），
         头部由 ProLayout 自带汉堡按钮唤起全屏浮层菜单，点击菜单项后自动收起 */
      menu={{ hideMenuWhenCollapsed: isMobile }}
      menuItemRender={(item, dom) =>
        item.path ? (
          <Link
            to={item.path}
            /* H5：菜单项点击后自动收起浮层菜单（ProLayout 通过 item.onClick 下发折叠回调） */
            onClick={isMobile ? () => item.onClick?.() : undefined}
          >
            {dom}
          </Link>
        ) : (
          dom
        )
      }
      avatarProps={{
        title: '平台运营',
        size: 'small',
        render: (_, dom) => (
          <Space>
            {dom}
            <Button size="small" type="text" danger onClick={logout}>
              退出
            </Button>
          </Space>
        ),
      }}
      token={proLayoutToken}
    >
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/journeys" element={<JourneysPage />} />
        <Route path="/procurement" element={<ProcurementPage />} />
        <Route path="/box-codes" element={<BoxCodesPage />} />
        <Route path="/channels" element={<ChannelsPage />} />
        <Route path="/commissions" element={<CommissionsPage />} />
        <Route path="/statements" element={<StatementsPage />} />
        <Route path="/prepaid" element={<PrepaidPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/samples" element={<SamplesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/interpretations" element={<InterpretationsPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="*" element={<ForbiddenPage />} />
      </Routes>
    </ProLayout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
