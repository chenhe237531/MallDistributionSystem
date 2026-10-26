import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { Button as NutButton, Input as NutInput } from '@nutui/nutui-react-taro'
import { formatCents } from '@mall/shared'
import { api, ensureLogin, routeParams } from '../../lib/api'
import { PageToast, toast } from '../../components/feedback'

/**
 * FR-C1 第 3 步：确认订单页。
 * 唯一主行动按钮「提交订单」固定在底部安全区上方、宽度通栏；
 * 渠道归属信息以只读摘要展示；金额遵循 §5.1（服务端取价，前端仅展示）。
 */
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

  const count = Number(quantity)
  const totalCents = price * (Number.isInteger(count) && count > 0 ? count : 0)

  const submit = async () => {
    if (!ensureLogin()) {
      return
    }
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
      toast('下单成功', 'success')
      void Taro.redirectTo({
        url: `/pages/pay-result/index?orderNo=${order.orderNo}`,
      })
    } catch (cause) {
      // FR-C1：下单业务错误以统一 Toast 提示并留在本页保留已填内容
      toast(cause instanceof Error ? cause.message : '下单失败', 'fail')
      setError(cause instanceof Error ? cause.message : '下单失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      <PageToast />
      <View className="card">
        <Text className="card-title">{productName}</Text>
        {merchantName ? <Text className="muted">{merchantName}</Text> : null}
        <View className="price-main">
          <Text className="price-main-symbol">¥</Text>
          <Text>{formatCents(price)}</Text>
        </View>
      </View>

      {channelCode ? (
        <View className="card">
          <Text className="section-title">渠道归属</Text>
          <View className="channel-summary">
            <Text>渠道码 {channelCode}</Text>
            <Text>本单佣金将归属该渠道</Text>
          </View>
        </View>
      ) : null}

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
      </View>

      <View className="card">
        <View className="row">
          <Text className="muted">商品合计</Text>
          <Text>¥{formatCents(price)} × {quantity || 0}</Text>
        </View>
        <View className="row">
          <Text className="card-title">应付合计</Text>
          <Text className="bottom-bar-amount-value">¥{formatCents(totalCents)}</Text>
        </View>
        <Text className="muted">
          支付由商家线下登记确认；检测盒寄出后请妥善保存，激活前请勿丢弃盒码。
        </Text>
      </View>

      <View className="bottom-bar-placeholder" />
      <View className="bottom-bar">
        <View className="bottom-bar-amount">
          <Text className="bottom-bar-amount-label">应付合计</Text>
          <Text className="bottom-bar-amount-value">¥{formatCents(totalCents)}</Text>
        </View>
        <View className="bottom-bar-main">
          <NutButton block type="primary" loading={loading} onClick={() => void submit()}>
            提交订单
          </NutButton>
        </View>
      </View>
    </View>
  )
}
