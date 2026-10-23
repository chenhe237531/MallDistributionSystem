import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'
import { api, ensureLogin } from '../../lib/api'

type Me = { roles: string[] }
type Claim = {
  id: string
  status: string
  customer: { name: string; phone: string } | null
}

export default function Claims() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [isSales, setIsSales] = useState(false)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const me = await api<Me>('/auth/me')
    setIsSales(me.roles.includes('sales'))
    setClaims(await api<Claim[]>('/sales-workbench/claims'))
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
    })
  })

  const submit = async () => {
    setLoading(true)
    try {
      await api('/sales-workbench/claims', {
        method: 'POST',
        data: { customerPhone: phone },
      })
      void Taro.showToast({ title: '认领申请已提交', icon: 'success' })
      setPhone('')
      await load()
    } catch (cause) {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '提交失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      {isSales ? (
        <View className="section">
          <Text className="section-title">申请认领客户</Text>
          <View className="card">
            <Input
              className="input"
              type="number"
              maxlength={11}
              placeholder="客户手机号"
              value={phone}
              onInput={(event) => setPhone(event.detail.value)}
            />
            <Button className="btn" loading={loading} onClick={submit}>
              提交申请
            </Button>
            <Text className="muted">需客户确认后生效，归属仍以盒码为准。</Text>
          </View>
        </View>
      ) : null}

      <View className="section">
        <Text className="section-title">认领记录</Text>
        {claims.length === 0 ? <Text className="muted">暂无记录</Text> : null}
        {claims.map((claim) => (
          <View key={claim.id} className="card">
            <View className="row">
              <Text>{claim.customer?.name ?? '客户'}</Text>
              <Text className="tag">{claim.status}</Text>
            </View>
            <Text className="muted">{claim.customer?.phone ?? ''}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
