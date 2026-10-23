import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, Switch, Text, View } from '@tarojs/components'
import { api, clearToken, ensureLogin, go } from '../../lib/api'

type Me = {
  id: string
  name: string
  phone: string
  realName: string | null
  idCardNo: string | null
  gender: string | null
  birthDate: string | null
}

type Ownership = {
  ownership: { channelType: string; sourceBoxCode: string; ownedAt: string } | null
  consent: { reportAuthorization: boolean; templateVersion: number; agreedAt: string } | null
  samples: Array<{ id: string; sampleNo: string; status: string; boxCode: { code: string } }>
}

export default function Profile() {
  const [me, setMe] = useState<Me | null>(null)
  const [ownership, setOwnership] = useState<Ownership | null>(null)
  const [realName, setRealName] = useState('')
  const [idCardNo, setIdCardNo] = useState('')
  const [gender, setGender] = useState('male')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    const [profile, owned] = await Promise.all([
      api<Me>('/customers/me'),
      api<Ownership>('/customers/me/ownership'),
    ])
    setMe(profile)
    setOwnership(owned)
    setRealName(profile.realName ?? '')
    setIdCardNo(profile.idCardNo ?? '')
    setGender(profile.gender ?? 'male')
  }

  useEffect(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
  }, [])

  const saveRealName = async () => {
    setError('')
    setMessage('')
    try {
      await api('/customers/me/real-name', {
        method: 'PATCH',
        data: {
          realName: realName.trim(),
          idCardNo: idCardNo.trim().toUpperCase(),
          gender,
        },
      })
      setMessage('实名信息已保存')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
    }
  }

  const toggleAuthorization = async (authorized: boolean) => {
    setError('')
    setMessage('')
    try {
      await api('/customers/me/report-authorization', {
        method: 'PATCH',
        data: { authorized },
      })
      setMessage(authorized ? '已授权渠道查看报告' : '已关闭渠道查看报告授权')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  return (
    <View className="page">
      <View className="hero">
        <Text className="hero-role">我的</Text>
        <Text className="hero-title">{me?.realName ?? me?.name ?? '未实名'}</Text>
        <Text className="hero-status">{me?.phone ?? ''}</Text>
      </View>

      {error ? <Text className="error">{error}</Text> : null}
      {message ? <Text className="muted">{message}</Text> : null}

      <View className="card">
        <Text className="section-title">实名认证</Text>
        <Text className="muted">激活检测盒前必须完成实名认证，信息仅用于检测服务与合规留痕。</Text>
        <Input
          className="input"
          value={realName}
          placeholder="真实姓名"
          onInput={(event) => setRealName(event.detail.value)}
        />
        <Input
          className="input"
          value={idCardNo}
          maxlength={18}
          placeholder="身份证号"
          onInput={(event) => setIdCardNo(event.detail.value)}
        />
        <Input
          className="input"
          value={gender}
          placeholder="性别 male / female"
          onInput={(event) => setGender(event.detail.value)}
        />
        <Button className="btn" onClick={() => void saveRealName()}>
          保存实名信息
        </Button>
      </View>

      <View className="card">
        <Text className="section-title">报告授权</Text>
        <Text className="muted">
          关闭后，商家与渠道仅能看到报告状态，无法查看指标与解读内容。
        </Text>
        <View className="row">
          <Text>允许渠道查看报告</Text>
          <Switch
            checked={ownership?.consent?.reportAuthorization ?? false}
            onChange={(event) => void toggleAuthorization(event.detail.value)}
          />
        </View>
        <Text className="muted">
          同意书版本：v{ownership?.consent?.templateVersion ?? '—'} · 签署时间：
          {ownership?.consent?.agreedAt
            ? new Date(ownership.consent.agreedAt).toLocaleString('zh-CN')
            : '—'}
        </Text>
      </View>

      <View className="card">
        <Text className="section-title">我的样本</Text>
        {ownership?.ownership ? (
          <Text className="muted">
            归属渠道：{ownership.ownership.channelType} · 来源盒码：
            {ownership.ownership.sourceBoxCode}
          </Text>
        ) : (
          <Text className="muted">尚未建立归属，激活检测盒后生成。</Text>
        )}
        {(ownership?.samples ?? []).map((sample) => (
          <View key={sample.id} className="row" style={{ marginTop: '12px' }}>
            <Text>{sample.sampleNo}</Text>
            <Text className="tag">{sample.status}</Text>
          </View>
        ))}
      </View>

      <Button className="btn-secondary" onClick={() => go('/pages/notifications/index')}>
        消息中心
      </Button>
      <Button
        className="btn-secondary"
        onClick={() => {
          clearToken()
          void Taro.reLaunch({ url: '/pages/index/index' })
        }}
      >
        退出登录
      </Button>
    </View>
  )
}
