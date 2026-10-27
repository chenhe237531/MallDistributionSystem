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
import { useTheme } from '../../lib/theme'

type Me = { roles: string[] }
type Claim = {
  id: string
  status: string
  customer: { name: string; phone: string } | null
  sales: { name: string; phone: string } | null
}

const toast = (title: string, icon?: 'success' | 'fail') =>
  Toast.show('b-toast', { title, icon })

export default function Claims() {
  const { themeClass } = useTheme()
  const [claims, setClaims] = useState<Claim[]>([])
  const [isSales, setIsSales] = useState(false)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState('')

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

  const resolve = async (claimId: string, confirm: boolean) => {
    setResolving(claimId)
    try {
      await api(`/sales-workbench/claims/${claimId}/${confirm ? 'confirm' : 'reject'}`, {
        method: 'POST',
      })
      toast(confirm ? '已确认认领' : '已拒绝认领', 'success')
      await load()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '操作失败')
    } finally {
      setResolving('')
    }
  }

  return (
    <View className={`page ${themeClass}`}>
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
                onChange={(value) => setPhone(value)}
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
              <View key={claim.id}>
                <Cell
                  title={claim.customer?.name ?? '客户'}
                  description={
                    <Text className="muted">
                      {claim.customer?.phone ?? ''}
                      {!isSales && claim.sales ? ` · 申请销售：${claim.sales.name}` : ''}
                    </Text>
                  }
                  extra={
                    <Tag type={CLAIM_STATUS_TONES[claim.status] ?? 'default'}>
                      {statusLabel(CLAIM_STATUS_LABELS, claim.status)}
                    </Tag>
                  }
                />
                {!isSales && claim.status === 'pending' ? (
                  <View className="claim-actions">
                    <View style={{ flex: 1 }}>
                      <NutButton
                        block
                        size="small"
                        type="primary"
                        loading={resolving === claim.id}
                        onClick={() => void resolve(claim.id, true)}
                      >
                        确认知领
                      </NutButton>
                    </View>
                    <View style={{ flex: 1 }}>
                      <NutButton
                        block
                        size="small"
                        fill="outline"
                        disabled={resolving === claim.id}
                        onClick={() => void resolve(claim.id, false)}
                      >
                        拒绝
                      </NutButton>
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
          </CellGroup>
        )}
      </View>

      <Toast id="b-toast" />
    </View>
  )
}
