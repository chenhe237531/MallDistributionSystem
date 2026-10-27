import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import {
  Button as NutButton,
  Input as NutInput,
  Switch as NutSwitch,
  Tag,
} from '@nutui/nutui-react-taro'
import { AppTabbar } from '../../components/AppTabbar'
import { Icon, type IconName } from '../../components/Icon'
import { api, clearToken, ensureLogin, go } from '../../lib/api'
import { CONSENT_PLACEHOLDER, REPORT_DISCLAIMER } from '../../lib/content'

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
}

type Claim = {
  id: string
  status: string
  sales: { name: string; phone: string } | null
}

type NotificationList = { unread: number }

const MENU: Array<{ key: string; label: string; icon: IconName; url: string }> = [
  { key: 'reports', label: '我的报告', icon: 'report', url: '/pages/reports/index' },
  { key: 'orders', label: '我的订单', icon: 'card', url: '/pages/orders/index' },
  { key: 'progress', label: '检测进度', icon: 'packageCheck', url: '/pages/progress/index' },
  { key: 'notifications', label: '消息中心', icon: 'message', url: '/pages/notifications/index' },
]

const PRIVACY_PLACEHOLDER =
  '隐私政策正文待企业提供后更新。健康信息仅用于检测服务与报告解读，我们将对个人资料严格保密。'

export default function Profile() {
  const [me, setMe] = useState<Me | null>(null)
  const [ownership, setOwnership] = useState<Ownership | null>(null)
  const [unread, setUnread] = useState(0)
  const [pendingClaims, setPendingClaims] = useState<Claim[]>([])
  const [realName, setRealName] = useState('')
  const [idCardNo, setIdCardNo] = useState('')
  const [gender, setGender] = useState('male')
  const [aboutDialog, setAboutDialog] = useState<'consent' | 'privacy' | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    const [profile, owned, notifications, claims] = await Promise.all([
      api<Me>('/customers/me'),
      api<Ownership>('/customers/me/ownership'),
      api<NotificationList>('/notifications/me').catch(() => ({ unread: 0 })),
      api<Claim[]>('/sales-workbench/claims').catch(() => [] as Claim[]),
    ])
    setMe(profile)
    setOwnership(owned)
    setUnread(notifications.unread)
    setPendingClaims(claims.filter((claim) => claim.status === 'pending'))
    setRealName(profile.realName ?? '')
    setIdCardNo(profile.idCardNo ?? '')
    setGender(profile.gender ?? 'male')
  }

  useEffect(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const resolveClaim = async (claimId: string, confirm: boolean) => {
    setError('')
    setMessage('')
    try {
      await api(`/sales-workbench/claims/${claimId}/${confirm ? 'confirm' : 'reject'}`, {
        method: 'POST',
      })
      setMessage(confirm ? '已同意认领，服务归属该顾问' : '已拒绝该认领申请')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  const verified = Boolean(me?.realName && me?.idCardNo)

  return (
    <View className="page page-with-tabbar">
      <View className="user-card">
        <View className="user-avatar">
          <Icon name="user" size={26} />
        </View>
        <View className="user-info">
          <Text className="user-phone">{me?.phone ?? '—'}</Text>
          <View className="row" style={{ justifyContent: 'flex-start', gap: '6px' }}>
            <Text className="user-sub">{me?.realName ?? me?.name ?? '未实名'}</Text>
            <Tag type={verified ? 'success' : 'warning'}>{verified ? '已实名' : '未实名'}</Tag>
          </View>
        </View>
      </View>

      <View className="menu-grid">
        {MENU.map((item) => (
          <View key={item.key} className="menu-item" role="button" onClick={() => go(item.url)}>
            <Icon name={item.icon} size={22} className="menu-icon" />
            <Text className="menu-label">{item.label}</Text>
            {item.key === 'notifications' && unread > 0 ? (
              <Text className="menu-badge">{unread > 99 ? '99+' : unread}</Text>
            ) : null}
          </View>
        ))}
      </View>

      {error ? <Text className="error">{error}</Text> : null}
      {message ? <Text className="muted">{message}</Text> : null}

      <View className="section">
        <Text className="section-title">实名认证</Text>
        <View className="card">
          <Text className="muted">激活检测盒前必须完成实名认证，信息仅用于检测服务与合规留痕。</Text>
          <View className="field-gap" />
          <NutInput
            value={realName}
            placeholder="真实姓名"
            clearable
            onChange={(value) => setRealName(value)}
          />
          <View className="field-gap" />
          <NutInput
            value={idCardNo}
            maxLength={18}
            placeholder="身份证号"
            clearable
            onChange={(value) => setIdCardNo(value)}
          />
          <View className="field-gap" />
          <NutInput
            value={gender}
            placeholder="性别 male / female"
            clearable
            onChange={(value) => setGender(value)}
          />
          <View className="field-gap" />
          <NutButton block type="primary" onClick={() => void saveRealName()}>
            保存实名信息
          </NutButton>
        </View>
      </View>

      <View className="section">
        <Text className="section-title">报告授权</Text>
        <View className="card">
          <Text className="muted">
            关闭后，商家与渠道仅能看到报告状态，无法查看指标与解读内容。
          </Text>
          <View className="row" style={{ marginTop: '8px' }}>
            <Text>允许渠道查看报告</Text>
            <NutSwitch
              checked={ownership?.consent?.reportAuthorization ?? false}
              onChange={(value) => void toggleAuthorization(value)}
            />
          </View>
          <Text className="muted">
            同意书版本：v{ownership?.consent?.templateVersion ?? '—'} · 签署时间：
            {ownership?.consent?.agreedAt
              ? new Date(ownership.consent.agreedAt).toLocaleString('zh-CN')
              : '—'}
          </Text>
          {ownership?.ownership ? (
            <Text className="muted">
              归属渠道：{ownership.ownership.channelType} · 来源盒码：
              {ownership.ownership.sourceBoxCode}
            </Text>
          ) : null}
        </View>
      </View>

      {pendingClaims.length > 0 ? (
        <View className="section">
          <Text className="section-title">认领确认</Text>
          {pendingClaims.map((claim) => (
            <View key={claim.id} className="card">
              <Text>
                {claim.sales?.name ?? '健康顾问'}
                {claim.sales?.phone ? `（${claim.sales.phone}）` : ''} 申请认领你为服务客户
              </Text>
              <Text className="muted">
                同意后，该顾问可为你提供检测报告解读等跟进服务；检测数据归属仍以检测盒来源为准。
              </Text>
              <View className="row" style={{ marginTop: '10px', gap: '10px' }}>
                <View style={{ flex: 1 }}>
                  <NutButton block type="primary" onClick={() => void resolveClaim(claim.id, true)}>
                    同意认领
                  </NutButton>
                </View>
                <View style={{ flex: 1 }}>
                  <NutButton block fill="outline" onClick={() => void resolveClaim(claim.id, false)}>
                    拒绝
                  </NutButton>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View className="section">
        <Text className="section-title">关于</Text>
        <View className="card">
          <View className="link-row" role="button" onClick={() => go('/pages/tech-intro/index')}>
            <Text>技术介绍</Text>
            <Text className="link-row-arrow">›</Text>
          </View>
          <View className="link-row" role="button" onClick={() => setAboutDialog('consent')}>
            <Text>知情同意书</Text>
            <Text className="link-row-arrow">›</Text>
          </View>
          <View className="link-row" role="button" onClick={() => setAboutDialog('privacy')}>
            <Text>隐私政策</Text>
            <Text className="link-row-arrow">›</Text>
          </View>
          <Text className="muted">{REPORT_DISCLAIMER}</Text>
        </View>
      </View>

      <NutButton
        block
        fill="outline"
        onClick={() => {
          clearToken()
          void Taro.reLaunch({ url: '/pages/index/index' })
        }}
      >
        退出登录
      </NutButton>

      {aboutDialog ? (
        <View className="sheet-mask" onClick={() => setAboutDialog(null)}>
          <View className="sheet-panel" onClick={(event) => event.stopPropagation()}>
            <View className="sheet-handle" />
            <Text className="sheet-title">
              {aboutDialog === 'consent' ? '知情同意书' : '隐私政策'}
            </Text>
            <View className="field-gap" />
            <Text className="muted">
              {aboutDialog === 'consent' ? CONSENT_PLACEHOLDER : PRIVACY_PLACEHOLDER}
            </Text>
            <View className="field-gap" />
            <NutButton block type="primary" onClick={() => setAboutDialog(null)}>
              我知道了
            </NutButton>
          </View>
        </View>
      ) : null}

      <AppTabbar active="profile" />
    </View>
  )
}
