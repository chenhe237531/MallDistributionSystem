import { useEffect, useState } from 'react'
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

/**
 * C 端收货地址簿：增删改、设默认地址；
 * picker=1 时（从确认订单页进入）点击地址即选中并返回，选择结果经本地缓存回传。
 */
export default function AddressBook() {
  const pickerMode = routeParams().picker === '1'
  const [list, setList] = useState<ShippingAddress[]>([])
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [receiverName, setReceiverName] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [region, setRegion] = useState('')
  const [detail, setDetail] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setList(await api<ShippingAddress[]>('/customers/me/addresses'))
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
    setEditingId(null)
    setReceiverName('')
    setReceiverPhone('')
    setRegion('')
    setDetail('')
    setIsDefault(list.length === 0)
    setFormOpen(true)
  }

  const openEdit = (address: ShippingAddress) => {
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
              <Text>设为默认地址</Text>
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
