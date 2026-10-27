import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import {
  Button as NutButton,
  Input as NutInput,
  Toast,
} from '@nutui/nutui-react-taro'
import { api, setToken } from '../../lib/api'
import { Icon } from '../../components/Icon'
import logoPng from '../../assets/logo.png'
import { useTheme } from '../../lib/theme'

type LoginResponse = {
  token: string
  user: { id: string; name: string; role: string }
}

/** 登录页卡片化（§6.3）：logo 位 + 协议勾选；协议文本 D7 占位，待法务审定 */
export default function Login() {
  const { themeClass } = useTheme()
  const [phone, setPhone] = useState('13900000001')
  const [password, setPassword] = useState('Merchant@123')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const showToast = (title: string, icon?: 'success' | 'fail') =>
    Toast.show('b-toast', { title, icon })

  const submit = async () => {
    if (!agreed) {
      showToast('请先阅读并同意《服务协议》与《隐私政策》')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        data: { phone, password },
      })
      if (!['merchant', 'sales'].includes(result.user.role)) {
        setError('该入口仅限商家或销售账号')
        return
      }
      setToken(result.token)
      showToast('登录成功', 'success')
      void Taro.redirectTo({ url: '/pages/index/index' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const showAgreement = (name: string) => {
    showToast(`《${name}》文本待法务审定后上线`)
  }

  return (
    <View className={`page login-page ${themeClass}`}>
      <Image src={logoPng} className="login-logo-img" mode="aspectFit" />
      <Text className="login-welcome">欢迎登录</Text>
      <Text className="login-welcome-sub">登录后可享受更好的服务体验</Text>

      <View className="card login-card">
        <View className="login-field">
          <Text className="login-label">手机号</Text>
          <NutInput
            type="number"
            maxLength={11}
            value={phone}
            placeholder="请输入手机号"
            onChange={(value) => setPhone(value)}
          />
        </View>
        <View className="login-field">
          <Text className="login-label">密码</Text>
          <NutInput
            type="password"
            value={password}
            placeholder="请输入密码"
            onChange={(value) => setPassword(value)}
          />
        </View>
        {error ? <Text className="error">{error}</Text> : null}
        <NutButton
          className="login-submit login-submit-purple"
          block
          type="primary"
          loading={loading}
          onClick={submit}
        >
          登录
        </NutButton>

        <View className="login-agreement">
          <View
            className={`login-checkbox ${agreed ? 'login-checkbox-checked' : ''}`}
            onClick={() => setAgreed(!agreed)}
          >
            {agreed ? <Icon name="check" size={10} className="login-check-icon" /> : null}
          </View>
          <Text className="login-agreement-text">已阅读并同意</Text>
          <Text className="login-agreement-link" onClick={() => showAgreement('服务协议')}>
            《服务协议》
          </Text>
          <Text className="login-agreement-text">与</Text>
          <Text className="login-agreement-link" onClick={() => showAgreement('隐私政策')}>
            《隐私政策》
          </Text>
        </View>

        <Text className="muted login-demo">演示账号：13900000001 / Merchant@123</Text>
      </View>

      <Toast id="b-toast" />
    </View>
  )
}
