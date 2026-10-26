import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { CLAIM_STATUS_LABELS, CLAIM_STATUS_TONES, statusLabel } from '@mall/shared'
import { api, ensureLogin } from '../../lib/api'
import {
  Button as NutButton,
  Cell,
  CellGroup,
  Empty,
  Input as NutInput,
  Tag,
  Toast,
} from '@nutui/nutui-react-taro'

type Me = { roles: string[] }
type Claim = {
  id: string
  status: string
  customer: { name: string; phone: string } | null
}

const toast = (title: string, icon?: 'success' | 'fail') =>
  Toast.show('b-toast', { title, icon })

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
      toast('认领申请已提交', 'success')
      setPhone('')
      await load()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '提交失败')
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
            <View className="form-field">
              <Text className="form-label">客户手机号</Text>
              <NutInput
                type="number"
                maxLength={11}
                value={phone}
                placeholder="请输入客户手机号"
                onBlur={(value) => setPhone(value)}
              />
            </View>
            <NutButton className="form-submit" block type="primary" loading={loading} onClick={submit}>
              提交申请
            </NutButton>
            <Text className="muted form-hint">需客户确认后生效，归属仍以盒码为准。</Text>
          </View>
        </View>
      ) : null}

      <View className="section">
        <Text className="section-title">认领记录</Text>
        {claims.length === 0 ? (
          <Empty description="暂无记录" />
        ) : (
          <CellGroup>
            {claims.map((claim) => (
              <Cell
                key={claim.id}
                title={claim.customer?.name ?? '客户'}
                description={<Text className="muted">{claim.customer?.phone ?? ''}</Text>}
                extra={
                  <Tag type={CLAIM_STATUS_TONES[claim.status] ?? 'default'}>
                    {statusLabel(CLAIM_STATUS_LABELS, claim.status)}
                  </Tag>
                }
              />
            ))}
          </CellGroup>
        )}
      </View>

      <Toast id="b-toast" />
    </View>
  )
}
