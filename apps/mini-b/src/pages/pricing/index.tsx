import { useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { Input as NutInput } from '@nutui/nutui-react-taro'
import {
  defaultRetailPriceCents,
  formatCents,
  grossMarginBps,
  parseYuanToCents,
} from '@mall/shared'
import { api, ensureLogin } from '../../lib/api'
import { PageToast, toast } from '../../components/feedback'
import { GoodsThumb } from '../../components/goods/GoodsThumb'
import { useTheme } from '../../lib/theme'

type Listing = {
  id: string
  retailPriceCents: number
  priceCustomized: boolean
  status: string
  product: {
    id: string
    name: string
    skuCode: string
    sampleType: string
    supplyPriceCents: number
    images: string[]
  }
}

const QUICK_MULTIPLES = [2, 2.2, 2.5, 3]

const marginPercent = (listing: Listing): string =>
  (grossMarginBps(listing.product.supplyPriceCents, listing.retailPriceCents) / 100).toFixed(1)

/**
 * 商品定价（方案 v1.2 §4）：C 端售价默认 = 采购价 × 2，商家可自定义。
 * 保存后写回 MerchantProduct.retailPriceCents，C 端商城即时生效。
 */
export default function Pricing() {
  const { themeClass } = useTheme()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Listing | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const rows = await api<Listing[]>('/products/merchant/mine')
    setListings(rows)
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void load()
      .catch((cause) => {
        toast(cause instanceof Error ? cause.message : '加载失败', 'fail')
      })
      .finally(() => setLoading(false))
  })

  const stats = useMemo(() => {
    const active = listings.filter((item) => item.status === 'active')
    const customized = listings.filter((item) => item.priceCustomized).length
    const avg =
      active.length > 0
        ? Math.round(
            active.reduce(
              (sum, item) =>
                sum + grossMarginBps(item.product.supplyPriceCents, item.retailPriceCents),
              0,
            ) / active.length,
          )
        : 0
    return { active: active.length, customized, avgMargin: (avg / 100).toFixed(1) }
  }, [listings])

  const sorted = useMemo(
    () =>
      [...listings].sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'active' ? -1 : 1
        }
        return a.product.name.localeCompare(b.product.name, 'zh-Hans-CN')
      }),
    [listings],
  )

  const openEditor = (listing: Listing) => {
    setEditing(listing)
    setPriceInput((listing.retailPriceCents / 100).toFixed(2))
  }

  const quickPrices = editing
    ? QUICK_MULTIPLES.map((multiple) => ({
        multiple,
        cents: Math.round(editing.product.supplyPriceCents * multiple),
      }))
    : []

  const save = async () => {
    if (!editing) {
      return
    }
    const cents = parseYuanToCents(priceInput)
    if (cents === null) {
      toast('请输入正确的金额，最多两位小数', 'fail')
      return
    }
    if (cents < editing.product.supplyPriceCents) {
      toast('售价不能低于采购价', 'fail')
      return
    }
    setSaving(true)
    try {
      await api(`/products/merchant/listings/${editing.id}`, {
        method: 'PATCH',
        data: { retailPriceCents: cents },
      })
      await load()
      setEditing(null)
      toast('C 端售价已更新', 'success')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '保存失败', 'fail')
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async (listing: Listing) => {
    try {
      await api(`/products/merchant/listings/${listing.id}`, {
        method: 'PATCH',
        data: { resetToDefault: true },
      })
      await load()
      toast('已恢复默认售价（采购价 2 倍）', 'success')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '操作失败', 'fail')
    }
  }

  return (
    <View className={`page pricing-page ${themeClass}`}>
      <PageToast />

      <View className="pricing-hero">
        <Text className="pricing-hero-title">C 端商品定价</Text>
        <Text className="pricing-hero-desc">
          默认按采购价 2 倍生成 C 端售价，支持自定义调整；C 端展示以本页设置为准。
        </Text>
        <View className="pricing-stats">
          <View className="pricing-stat">
            <Text className="pricing-stat-value">{stats.active}</Text>
            <Text className="pricing-stat-label">在售商品</Text>
          </View>
          <View className="pricing-stat">
            <Text className="pricing-stat-value">{stats.customized}</Text>
            <Text className="pricing-stat-label">自定义定价</Text>
          </View>
          <View className="pricing-stat">
            <Text className="pricing-stat-value">{stats.avgMargin}%</Text>
            <Text className="pricing-stat-label">平均毛利</Text>
          </View>
        </View>
      </View>

      {loading ? <Text className="pricing-tip">加载中…</Text> : null}
      {!loading && sorted.length === 0 ? (
        <Text className="pricing-tip">暂无已上架商品，请先在采购页选品上架。</Text>
      ) : null}

      {sorted.map((listing) => (
        <View key={listing.id} className="pricing-card">
          <View className="pricing-head">
            <GoodsThumb
              src={listing.product.images[0]}
              name={listing.product.name}
              size="md"
            />
            <View className="pricing-info">
              <Text className="pricing-name">{listing.product.name}</Text>
              <Text className="pricing-sku">
                {listing.product.skuCode} · {listing.product.sampleType}
              </Text>
              <View className="pricing-price-row">
                <Text className="pricing-cost">
                  采购价 ¥{formatCents(listing.product.supplyPriceCents)}
                </Text>
                <Text className="pricing-arrow">→</Text>
                <Text className="pricing-retail">
                  C 端 ¥{formatCents(listing.retailPriceCents)}
                </Text>
              </View>
            </View>
          </View>

          <View className="pricing-foot">
            <View className="pricing-badges">
              <Text
                className={`pricing-badge ${listing.priceCustomized ? 'pricing-badge-custom' : ''}`}
              >
                {listing.priceCustomized ? '自定义价' : '默认 2 倍'}
              </Text>
              <Text className="pricing-margin">毛利 {marginPercent(listing)}%</Text>
              {listing.status !== 'active' ? (
                <Text className="pricing-offline">已下架</Text>
              ) : null}
            </View>
            <View className="pricing-actions">
              {listing.priceCustomized ? (
                <Text className="pricing-reset" onClick={() => void resetToDefault(listing)}>
                  恢复默认
                </Text>
              ) : null}
              <View className="pricing-edit" onClick={() => openEditor(listing)}>
                改价
              </View>
            </View>
          </View>
        </View>
      ))}

      <Text className="pricing-note">
        售价下限为采购价，避免亏本销售；调价后 C 端商品列表与详情页价格同步更新。
      </Text>

      {editing ? (
        <View className="pricing-mask" onClick={() => setEditing(null)}>
          <View className="pricing-sheet" onClick={(event) => event.stopPropagation()}>
            <View className="pricing-sheet-head">
              <Text className="pricing-sheet-title">调整 C 端售价</Text>
              <Text className="pricing-sheet-close" onClick={() => setEditing(null)}>
                ✕
              </Text>
            </View>
            <Text className="pricing-sheet-name">{editing.product.name}</Text>
            <View className="pricing-sheet-meta">
              <Text>采购价 ¥{formatCents(editing.product.supplyPriceCents)}</Text>
              <Text>
                默认售价 ¥
                {formatCents(defaultRetailPriceCents(editing.product.supplyPriceCents))}
              </Text>
            </View>

            <View className="pricing-input-row">
              <Text className="pricing-input-symbol">¥</Text>
              <NutInput
                className="pricing-input"
                type="digit"
                value={priceInput}
                placeholder="请输入 C 端售价"
                onChange={(value) => setPriceInput(String(value))}
              />
            </View>

            <View className="pricing-quick">
              {quickPrices.map((quick) => {
                const value = (quick.cents / 100).toFixed(2)
                return (
                  <View
                    key={quick.multiple}
                    className={`pricing-quick-item ${priceInput === value ? 'pricing-quick-active' : ''}`}
                    onClick={() => setPriceInput(value)}
                  >
                    {quick.multiple} 倍
                  </View>
                )
              })}
            </View>

            <Text className="pricing-hint">
              修改后 C 端立即生效；实际成交价以 C 端展示为准。
            </Text>

            <View className="pricing-sheet-actions">
              <View className="pricing-sheet-cancel" onClick={() => setEditing(null)}>
                取消
              </View>
              <View className="pricing-sheet-save" onClick={() => void save()}>
                {saving ? '保存中…' : '保存'}
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
