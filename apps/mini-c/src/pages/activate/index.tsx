import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, Switch, Text, View } from '@tarojs/components'
import { api, ensureLogin, go, routeParams } from '../../lib/api'

type ActivationResult = {
  sample: { id: string; sampleNo: string; status: string }
  ownership: { channelType: string; sourceBoxCode: string }
  consent: { reportAuthorization: boolean; templateVersion: number }
}

export default function Activate() {
  const params = routeParams()
  const [boxCode, setBoxCode] = useState(params.code ?? '')
  const [orderId, setOrderId] = useState(params.orderId ?? '')
  const [gender, setGender] = useState('male')
  const [age, setAge] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)
  const [reportAuthorization, setReportAuthorization] = useState(true)
  const [result, setResult] = useState<ActivationResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!ensureLogin()) {
      return
    }
    if (!consentGiven) {
      setError('请先阅读并同意检测服务协议与知情同意书')
      return
    }
    if (!age) {
      setError('请填写年龄')
      return
    }
    setLoading(true)
    setError('')
    try {
      const activated = await api<ActivationResult>('/box-codes/activate', {
        method: 'POST',
        data: {
          boxCode: boxCode.trim().toUpperCase(),
          orderId: orderId.trim() || undefined,
          questionnaire: { gender, age: Number(age) },
          consentGiven,
          reportAuthorization,
          samplingMethod: 'self_mail',
          device: 'mini-c-h5',
        },
      })
      setResult(activated)
      void Taro.showToast({ title: '激活成功', icon: 'success' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '激活失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      <View className="card">
        <Text className="section-title">扫码激活检测盒</Text>
        <Text className="muted">
          一盒一码，激活后建立样本与客户归属。激活前请完成实名认证。
        </Text>
        <Input
          className="input"
          value={boxCode}
          placeholder="盒码（BX 开头）"
          onInput={(event) => setBoxCode(event.detail.value)}
        />
        <Input
          className="input"
          value={orderId}
          placeholder="关联订单 ID（可选，用于绑定成交）"
          onInput={(event) => setOrderId(event.detail.value)}
        />
        <Text className="muted">采样人信息</Text>
        <Input
          className="input"
          value={gender}
          placeholder="性别 male / female"
          onInput={(event) => setGender(event.detail.value)}
        />
        <Input
          className="input"
          type="number"
          value={age}
          placeholder="年龄"
          onInput={(event) => setAge(event.detail.value)}
        />
        <View className="row">
          <Text>报告授权给商家/渠道查看</Text>
          <Switch
            checked={reportAuthorization}
            onChange={(event) => setReportAuthorization(event.detail.value)}
          />
        </View>
        <View className="row">
          <Text>已阅读并同意检测服务协议与知情同意书</Text>
          <Switch
            checked={consentGiven}
            onChange={(event) => setConsentGiven(event.detail.value)}
          />
        </View>
        {error ? <Text className="error">{error}</Text> : null}
        <Button className="btn" loading={loading} onClick={() => void submit()}>
          激活
        </Button>
        <Button className="btn-secondary" onClick={() => go('/pages/profile/index')}>
          去完成实名认证
        </Button>
      </View>

      {result ? (
        <View className="card">
          <Text className="section-title">激活成功</Text>
          <Text>样本编号：{result.sample.sampleNo}</Text>
          <Text className="muted">归属类型：{result.ownership.channelType}</Text>
          <Text className="muted">盒码：{result.ownership.sourceBoxCode}</Text>
          <Text className="muted">
            报告授权：{result.consent.reportAuthorization ? '已授权' : '未授权'} · 同意书 v
            {result.consent.templateVersion}
          </Text>
          <Button className="btn" onClick={() => go('/pages/reports/index')}>
            查看我的报告
          </Button>
        </View>
      ) : null}
    </View>
  )
}
