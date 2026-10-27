import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import {
  Button as NutButton,
  Empty,
  Input as NutInput,
  Switch as NutSwitch,
  Tag,
} from '@nutui/nutui-react-taro'
import { api, ensureLogin, routeParams } from '../../lib/api'
import { PageToast, toast } from '../../components/feedback'
import {
  PHONE_PATTERN,
  emitAddressSelected,
  fullAddressText,
  type ShippingAddress,
} from '../../lib/address'

/** 注册资料（/customers/me）：仅取新增地址预填所需字段 */
type CustomerProfile = {
  name?: string | null
  phone?: string | null
  realName?: string | null
}

/** 注册资料可能缺失或为空白，统一裁剪成可预填的字符串 */
function trimOrEmpty(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 收货人默认值：注册姓名优先，其次实名姓名；都没有则留空由用户手动填写 */
function defaultReceiverName(profile: CustomerProfile | null): string {
  return trimOrEmpty(profile?.name) || trimOrEmpty(profile?.realName)
}

function defaultReceiverPhone(profile: CustomerProfile | null): string {
  return trimOrEmpty(profile?.phone)
}

/**
 * C 端收货地址簿：增删改、设默认地址；
 * picker=1 时（从确认订单页进入）点击地址即选中并返回，选择结果经本地缓存回传。
 */
export default function AddressBook() {
  const pickerMode = routeParams().picker === '1'
  const [list, setList] = useState<ShippingAddress[]>([])
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [receiverName, setReceiverName] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [region, setRegion] = useState('')
  const [detail, setDetail] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  /** 表单打开序号：异步补填资料时用于判断用户是否已切到其它表单 */
  const formSeq = useRef(0)

  const loadProfile = async (): Promise<CustomerProfile | null> => {
    try {
      const me = await api<CustomerProfile>('/customers/me')
      setProfile(me)
      return me
    } catch {
      // 注册资料只是预填来源，读取失败不阻断地址簿主流程
      return null
    }
  }

  const load = async () => {
    try {
      const [addresses] = await Promise.all([
        api<ShippingAddress[]>('/customers/me/addresses'),
        // 与地址列表并行拉取注册资料，供「新增收货地址」预填姓名与手机号
        loadProfile(),
      ])
      setList(addresses)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载失败')
    }
  }

  useEffect(() => {
    if (!ensureLogin()) {
      return
    }
    void load()
  }, [])

  const openCreate = () => {
    formSeq.current += 1
    const seq = formSeq.current
    setEditingId(null)
    // 预填注册时填写的姓名与手机号；资料缺失或为空时保持空值，允许手动输入
    setReceiverName(defaultReceiverName(profile))
    setReceiverPhone(defaultReceiverPhone(profile))
    setRegion('')
    setDetail('')
    setIsDefault(list.length === 0)
    setFormOpen(true)
    if (profile) {
      return
    }
    // 资料仍在加载：到达后补齐预填，且只填空字段，不覆盖用户已输入的内容
    void loadProfile().then((me) => {
      if (!me || seq !== formSeq.current) {
        return
      }
      const name = defaultReceiverName(me)
      const phone = defaultReceiverPhone(me)
      if (name) {
        setReceiverName((current) => current || name)
      }
      if (phone) {
        setReceiverPhone((current) => current || phone)
      }
    })
  }

  const openEdit = (address: ShippingAddress) => {
    formSeq.current += 1
    setEditingId(address.id)
    setReceiverName(address.receiverName)
    setReceiverPhone(address.receiverPhone)
    setRegion(address.region)
    setDetail(address.detail)
    setIsDefault(address.isDefault)
    setFormOpen(true)
  }

  const save = async () => {
    if (!receiverName.trim()) {
      toast('请填写收货人姓名', 'fail')
      return
    }
    if (!PHONE_PATTERN.test(receiverPhone)) {
      toast('请输入正确的 11 位手机号', 'fail')
      return
    }
    if (detail.trim().length < 2) {
      toast('请填写详细地址', 'fail')
      return
    }
    setSaving(true)
    try {
      const payload = {
        receiverName: receiverName.trim(),
        receiverPhone,
        region: region.trim() || undefined,
        detail: detail.trim(),
        isDefault,
      }
      if (editingId) {
        await api(`/customers/me/addresses/${editingId}`, { method: 'PATCH', data: payload })
      } else {
        await api('/customers/me/addresses', { method: 'POST', data: payload })
      }
      toast('收货地址已保存', 'success')
      setFormOpen(false)
      await load()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '保存失败', 'fail')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (address: ShippingAddress) => {
    const confirmed = await Taro.showModal({
      title: '删除收货地址',
      content: `确定删除「${address.receiverName} ${fullAddressText(address)}」吗？`,
      confirmText: '删除',
      confirmColor: '#e34d59',
    })
    if (!confirmed.confirm) {
      return
    }
    try {
      await api(`/customers/me/addresses/${address.id}`, { method: 'DELETE' })
      toast('已删除', 'success')
      await load()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '删除失败', 'fail')
    }
  }

  const setAsDefault = async (address: ShippingAddress) => {
    try {
      await api(`/customers/me/addresses/${address.id}`, {
        method: 'PATCH',
        data: {
          receiverName: address.receiverName,
          receiverPhone: address.receiverPhone,
          region: address.region || undefined,
          detail: address.detail,
          isDefault: true,
        },
      })
      toast('已设为默认地址', 'success')
      await load()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '操作失败', 'fail')
    }
  }

  const pick = (address: ShippingAddress) => {
    emitAddressSelected(address)
    void Taro.navigateBack()
  }

  return (
    <View className="page">
      <PageToast />
      <View className="section">
        <Text className="section-title">
          {pickerMode ? '选择收货地址' : '我的收货地址'}
        </Text>
        {error ? <Text className="error">{error}</Text> : null}
        {list.length === 0 && !error ? <Empty description="还没有收货地址，先新增一个吧" /> : null}
        {list.map((address) => (
          <View key={address.id} className="card address-card">
            <View
              className="address-card-body"
              role="button"
              onClick={() => (pickerMode ? pick(address) : openEdit(address))}
            >
              <View className="row">
                <Text className="address-card-name">{address.receiverName}</Text>
                <Text className="muted">{address.receiverPhone}</Text>
                {address.isDefault ? <Tag type="primary">默认</Tag> : null}
              </View>
              <Text className="address-card-detail">{fullAddressText(address)}</Text>
            </View>
            <View className="address-card-actions">
              {address.isDefault ? null : (
                <NutButton size="small" fill="outline" onClick={() => void setAsDefault(address)}>
                  设为默认
                </NutButton>
              )}
              <NutButton size="small" fill="outline" onClick={() => openEdit(address)}>
                编辑
              </NutButton>
              <NutButton size="small" fill="outline" onClick={() => void remove(address)}>
                删除
              </NutButton>
            </View>
          </View>
        ))}
      </View>

      <View className="bottom-bar-placeholder" />
      <View className="bottom-bar">
        <View className="bottom-bar-main">
          <NutButton block type="primary" onClick={openCreate}>
            新增收货地址
          </NutButton>
        </View>
      </View>

      {formOpen ? (
        <View className="sheet-mask" onClick={() => setFormOpen(false)}>
          <View className="sheet-panel" onClick={(event) => event.stopPropagation()}>
            <View className="sheet-handle" />
            <Text className="sheet-title">{editingId ? '编辑收货地址' : '新增收货地址'}</Text>
            <View className="field-gap" />
            <NutInput
              value={receiverName}
              placeholder="收货人姓名"
              clearable
              onChange={(value) => setReceiverName(value)}
            />
            <View className="field-gap" />
            <NutInput
              type="number"
              maxLength={11}
              value={receiverPhone}
              placeholder="收货人手机号（11 位）"
              clearable
              onChange={(value) => setReceiverPhone(value)}
            />
            <View className="field-gap" />
            <NutInput
              value={region}
              placeholder="所在地区（省市区，选填）"
              clearable
              onChange={(value) => setRegion(value)}
            />
            <View className="field-gap" />
            <NutInput
              value={detail}
              placeholder="详细地址（街道、门牌号）"
              clearable
              onChange={(value) => setDetail(value)}
            />
            <View className="field-gap" />
            <View className="row">
              <Text className="address-default-label">设为默认地址</Text>
              <NutSwitch checked={isDefault} onChange={(value) => setIsDefault(value)} />
            </View>
            <View className="field-gap" />
            <NutButton block type="primary" loading={saving} onClick={() => void save()}>
              保存
            </NutButton>
          </View>
        </View>
      ) : null}
    </View>
  )
}
