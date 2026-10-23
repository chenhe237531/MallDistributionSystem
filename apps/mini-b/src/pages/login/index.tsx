import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import {
  Button as NutButton,
  Input as NutInput,
  Toast,
} from '@nutui/nutui-react-taro'
import { api, setToken } from '../../lib/api'

type LoginResponse = {
  token: string
  user: { id: string; name: string; role: string }
}

export default function Login() {
  const [phone, setPhone] = useState('13900000001')
  const [password, setPassword] = useState('Merchant@123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
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
      Toast.show('b-toast', { title: '登录成功', icon: 'success' })
      void Taro.redirectTo({ url: '/pages/index/index' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page login-page">
      <View className="hero">
        <Text className="hero-role">商城-分销系统</Text>
        <Text className="hero-title">商家工作台</Text>
        <Text className="hero-status">采购、客户、报告与培训</Text>
      </View>

      <View className="card login-card">
        <Text className="login-title">账号登录</Text>
        <View className="login-field">
          <Text className="login-label">手机号</Text>
          <NutInput
            type="number"
            maxLength={11}
            value={phone}
            placeholder="请输入手机号"
            onBlur={(value) => setPhone(value)}
          />
        </View>
        <View className="login-field">
          <Text className="login-label">密码</Text>
          <NutInput
            type="password"
            value={password}
            placeholder="请输入密码"
            onBlur={(value) => setPassword(value)}
          />
        </View>
        {error ? <Text className="error">{error}</Text> : null}
        <NutButton className="login-submit" block type="primary" loading={loading} onClick={submit}>
          登录
        </NutButton>
        <Text className="muted login-demo">演示账号：13900000001 / Merchant@123</Text>
      </View>

      <Toast id="b-toast" />
    </View>
  )
}
