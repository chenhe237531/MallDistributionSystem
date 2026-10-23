import { useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { Button, Space } from 'antd'
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
import { clearToken, getToken } from './lib/api'
import AccountsPage from './pages/AccountsPage'
import AlertsPage from './pages/AlertsPage'
import AuditPage from './pages/AuditPage'
import BoxCodesPage from './pages/BoxCodesPage'
import ChannelsPage from './pages/ChannelsPage'
import CommissionsPage from './pages/CommissionsPage'
import ContractsPage from './pages/ContractsPage'
import DashboardPage from './pages/DashboardPage'
import InterpretationsPage from './pages/InterpretationsPage'
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

function Shell() {
  const [token, setTokenState] = useState(getToken())
  const location = useLocation()

  if (!token) {
    return <LoginPage onLogin={() => setTokenState(getToken())} />
  }

  const logout = () => {
    clearToken()
    setTokenState('')
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
      menuItemRender={(item, dom) =>
        item.path ? (
          <Link to={item.path}>{dom}</Link>
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
      token={{
        header: {
          colorBgHeader: '#0f172a',
          colorTextRightActionsItem: '#e2e8f0',
        },
        sider: {
          colorTextMenuSelected: '#0f766e',
          colorBgMenuItemSelected: '#e6fffb',
        },
      }}
    >
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/orders" element={<OrdersPage />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
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
