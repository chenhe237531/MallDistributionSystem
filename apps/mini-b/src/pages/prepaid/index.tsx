import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'
import { formatCents, parseYuanToCents } from '@mall/shared'
import { api, ensureLogin } from '../../lib/api'

type Entry = { id: string; type: string; amountCents: number; createdAt: string }
type Recharge = { id: string; rechargeNo: string; amountCents: number; status: string }
type Prepaid = {
  account: { availableCents: number; frozenCents: number }
  entries: Entry[]
  recharges: Recharge[]
}

export default function Prepaid() {
  const [data, setData] = useState<Prepaid | null>(null)
  const [amount, setAmount] = useState('')
  const [voucher, setVoucher] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setData(await api<Prepaid>('/prepaid/me'))
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
    const cents = parseYuanToCents(amount)
    if (!cents || cents <= 0) {
      void Taro.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      await api('/prepaid/recharges', {
        method: 'POST',
        data: {
          amountCents: cents,
          paidAmountCents: cents,
          voucherUrl: voucher || undefined,
        },
      })
      void Taro.showToast({ title: '充值申请已提交', icon: 'success' })
      setAmount('')
      setVoucher('')
      await load()
    } catch (cause) {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '提交失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      <View className="hero">
        <Text className="hero-role">预付款账户</Text>
        <Text className="hero-title">
          {data ? formatCents(data.account.availableCents) : '—'} 元
        </Text>
        <Text className="hero-status">
          冻结 {data ? formatCents(data.account.frozenCents) : '—'} 元
        </Text>
      </View>

      <View className="section">
        <Text className="section-title">发起充值</Text>
        <View className="card">
          <Input
            className="input"
            placeholder="充值金额（元）"
            value={amount}
            onInput={(event) => setAmount(event.detail.value)}
          />
          <Input
            className="input"
            placeholder="打款凭证地址（选填）"
            value={voucher}
            onInput={(event) => setVoucher(event.detail.value)}
          />
          <Button className="btn" loading={loading} onClick={submit}>
            提交充值申请
          </Button>
          <Text className="muted">线下打款后由平台财务入账，系统不发起支付。</Text>
        </View>
      </View>

      <View className="section">
        <Text className="section-title">流水</Text>
        {data?.entries.map((entry) => (
          <View key={entry.id} className="card">
            <View className="row">
              <Text>{entry.type}</Text>
              <Text>{formatCents(entry.amountCents)} 元</Text>
            </View>
            <Text className="muted">{entry.createdAt}</Text>
          </View>
        ))}
      </View>

      <View className="section">
        <Text className="section-title">充值单</Text>
        {data?.recharges.map((recharge) => (
          <View key={recharge.id} className="card">
            <View className="row">
              <Text>{recharge.rechargeNo}</Text>
              <Text className="tag">{recharge.status}</Text>
            </View>
            <Text className="muted">{formatCents(recharge.amountCents)} 元</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
