import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import {
  Button as NutButton,
  Input as NutInput,
  Price,
  Tag,
  Toast,
} from '@nutui/nutui-react-taro'
import { formatCents } from '@mall/shared'
import { api, ensureLogin, routeParams } from '../../lib/api'

export default function Order() {
  const params = routeParams()
  const listingId = params.listingId ?? ''
  const productName = decodeURIComponent(params.name ?? '检测盒')
  const merchantName = decodeURIComponent(params.merchant ?? '')
  const price = Number(params.price ?? 0)
  const channelCode = params.channel ?? ''

  const [quantity, setQuantity] = useState('1')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!ensureLogin()) {
      return
    }
    const count = Number(quantity)
    if (!Number.isInteger(count) || count < 1) {
      setError('购买数量至少为 1')
      return
    }
    setLoading(true)
    setError('')
    try {
      const order = await api<{ id: string; orderNo: string; totalAmountCents: number }>(
        '/sales-orders',
        {
          method: 'POST',
          data: {
            items: [{ listingId, quantity: count }],
            contactName,
            contactPhone,
            address: address || undefined,
            channelCode: channelCode || undefined,
          },
        },
      )
      Toast.show('order-toast', { title: '下单成功', icon: 'success' })
      void Taro.redirectTo({
        url: `/pages/orders/index?highlight=${order.orderNo}`,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '下单失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      <Toast id="order-toast" />
      <View className="card">
        <Text className="card-title">{productName}</Text>
        <Text className="muted">{merchantName}</Text>
        <View className="price-row">
          <Price price={formatCents(price)} symbol="¥" color="#dc2626" size="large" />
          {channelCode ? <Tag plain type="info">渠道码 {channelCode}</Tag> : null}
        </View>
      </View>

      <View className="card">
        <Text className="section-title">收货与联系信息</Text>
        <NutInput
          value={contactName}
          placeholder="联系人姓名"
          clearable
          onChange={(value) => setContactName(value)}
        />
        <View className="field-gap" />
        <NutInput
          type="number"
          maxLength={11}
          value={contactPhone}
          placeholder="联系人手机号"
          clearable
          onChange={(value) => setContactPhone(value)}
        />
        <View className="field-gap" />
        <NutInput
          value={address}
          placeholder="收货地址（检测盒寄送）"
          clearable
          onChange={(value) => setAddress(value)}
        />
        <View className="field-gap" />
        <NutInput
          type="number"
          value={quantity}
          placeholder="购买数量"
          onChange={(value) => setQuantity(value)}
        />
        {error ? <Text className="error">{error}</Text> : null}
        <View className="field-gap" />
        <NutButton block type="primary" loading={loading} onClick={() => void submit()}>
          提交订单（{formatCents(price * (Number(quantity) || 0))} 元）
        </NutButton>
        <Text className="muted">
          支付由商家线下登记确认；检测盒寄出后请妥善保存，激活前请勿丢弃盒码。
        </Text>
      </View>
    </View>
  )
}
