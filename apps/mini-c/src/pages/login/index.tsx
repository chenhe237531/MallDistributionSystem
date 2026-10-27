import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { Button as NutButton, Input as NutInput } from '@nutui/nutui-react-taro'
import { api, setToken } from '../../lib/api'
import { normalizeInviteInput } from '../../lib/invite'
import { BRAND, REPORT_DISCLAIMER } from '../../lib/content'
import logo from '../../assets/logo.png'

type AuthResponse = {
  token: string
  user: { id: string; name: string; role: string }
}

/** C 端演示账号：点击自动填充，再点登录即可进入该用户 */
const DEMO_ACCOUNTS = [
  { label: '演示客户', phone: '13900000003', password: 'Customer@123' },
]

function deviceId(): string {
  const key = 'mall_c_device'
  const existing = Taro.getStorageSync(key)
  if (existing) {
    return existing
  }
  const value = `h5-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  Taro.setStorageSync(key, value)
  return value
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setMode('login')
    setPhone(account.phone)
    setPassword(account.password)
    setError('')
  }

  /** 扫描商家邀请码二维码；H5 浏览器环境不支持时提示手动输入 */
  const scanInvite = async () => {
    try {
      const result = await Taro.scanCode({ scanType: ['qrCode'] })
      const code = normalizeInviteInput(result.result ?? '')
      if (code) {
        setInviteCode(code)
        setError('')
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      if (!message.includes('cancel')) {
        Taro.showToast({ title: '当前环境不支持扫码，请手动输入邀请码', icon: 'none' })
      }
    }
  }

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const normalizedInvite = normalizeInviteInput(inviteCode)
      const data =
        mode === 'login'
          ? { phone, password }
          : { phone, password, name, deviceId: deviceId(), inviteCode: normalizedInvite || undefined }
      const result = await api<AuthResponse>(path, { method: 'POST', data })
      if (result.user.role !== 'customer') {
        setError('该入口仅限 C 端用户')
        return
      }
      setToken(result.token)
      // 登录入口填写的邀请码：登录成功后立即完成与商家端销售的绑定
      if (mode === 'login' && normalizedInvite) {
        await api('/customers/me/invite-code', {
          method: 'POST',
          data: { code: normalizedInvite },
        }).catch((cause) => {
          Taro.showToast({
            title: cause instanceof Error ? cause.message : '邀请码绑定失败',
            icon: 'none',
            duration: 3000,
          })
        })
      }
      void Taro.redirectTo({ url: '/pages/index/index' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      <View className="brand-hero">
        <View className="brand-logo-row">
          <Image className="brand-logo" src={logo} mode="aspectFit" />
          <Text className="brand-name">{BRAND.name}</Text>
        </View>
        <Text className="brand-title">{BRAND.title}</Text>
        <Text className="brand-subtitle">居家采样 · 扫码绑定 · 查看报告与解读</Text>
      </View>

      <View className="card" style={{ marginTop: '12px' }}>
        <Text className="section-title">{mode === 'login' ? '登录' : '注册'}</Text>
        {mode === 'register' ? (
          <NutInput
            value={name}
            placeholder="姓名"
            clearable
            onChange={(value) => setName(value)}
          />
        ) : null}
        {mode === 'register' ? <View className="field-gap" /> : null}
        <NutInput
          type="number"
          maxLength={11}
          value={phone}
          placeholder="手机号"
          clearable
          onChange={(value) => setPhone(value)}
        />
        <View className="field-gap" />
        <NutInput
          type="password"
          value={password}
          placeholder="密码（至少 6 位）"
          onChange={(value) => setPassword(value)}
        />
        <View className="field-gap" />
        <View className="invite-input-row">
          <NutInput
            value={inviteCode}
            placeholder="商家邀请码（选填）"
            clearable
            onChange={(value) => setInviteCode(value.toUpperCase())}
          />
          <NutButton
            className="invite-scan-btn"
            size="small"
            fill="outline"
            onClick={() => void scanInvite()}
          >
            扫码
          </NutButton>
        </View>
        <Text className="invite-hint">填写商家邀请码后，将与对应商家 / 顾问建立服务绑定</Text>
        {error ? <Text className="error">{error}</Text> : null}
        <View className="field-gap" />
        <NutButton block type="primary" loading={loading} onClick={() => void submit()}>
          {mode === 'login' ? '登录' : '注册并登录'}
        </NutButton>
        <View className="action-gap" />
        <NutButton
          block
          fill="outline"
          onClick={() => {
            setError('')
            setMode(mode === 'login' ? 'register' : 'login')
          }}
        >
          {mode === 'login' ? '没有账号，去注册' : '已有账号，去登录'}
        </NutButton>
        <View className="login-demo">
          <Text className="login-demo-title">演示账号 · 点击自动填充</Text>
          {DEMO_ACCOUNTS.map((account) => (
            <View
              key={account.phone}
              className="login-demo-item"
              onClick={() => fillDemo(account)}
            >
              <View className="login-demo-main">
                <Text className="login-demo-role">{account.label}</Text>
                <Text className="login-demo-account">
                  {account.phone} / {account.password}
                </Text>
              </View>
              <Text className="login-demo-action">填充</Text>
            </View>
          ))}
          <Text className="login-demo-hint">填充后点击「登录」即可进入该用户</Text>
        </View>
      </View>
      <View className="notice">
        <Text>{REPORT_DISCLAIMER}</Text>
      </View>
    </View>
  )
}
