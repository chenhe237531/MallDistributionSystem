import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'
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
      void Taro.redirectTo({ url: '/pages/index/index' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      <View className="hero">
        <Text className="hero-role">商城-分销系统</Text>
        <Text className="hero-title">商家工作台</Text>
        <Text className="hero-status">采购、客户、报告与培训</Text>
      </View>
      <View className="card">
        <Text className="section-title">账号登录</Text>
        <Input
          className="input"
          type="number"
          maxlength={11}
          value={phone}
          placeholder="手机号"
          onInput={(event) => setPhone(event.detail.value)}
        />
        <Input
          className="input"
          password
          value={password}
          placeholder="密码"
          onInput={(event) => setPassword(event.detail.value)}
        />
        {error ? <Text className="error">{error}</Text> : null}
        <Button className="btn" loading={loading} onClick={submit}>
          登录
        </Button>
        <Text className="muted">演示账号：13900000001 / Merchant@123</Text>
      </View>
    </View>
  )
}
