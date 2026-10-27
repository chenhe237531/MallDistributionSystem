import { PRODUCT_CATEGORIES } from '@mall/shared'
import { api } from './api'

/**
 * C 端商城商品（与商家端同一 Product 数据源，见 GET /sales-orders/storefront）。
 * 价格 = 商家上架价（默认采购价 × 2，商家可在商家端「商品定价」调整）。
 */
export type StorefrontRelated = {
  productId: string
  name: string
  skuCode: string
  images: string[]
  listingId: string | null
  retailPriceCents: number | null
}

export type StorefrontProduct = {
  listingId: string
  merchantId: string
  merchantName: string
  productId: string
  productName: string
  skuCode: string
  category: string | null
  categoryLabel: string
  images: string[]
  intro: string | null
  guideVideoUrl: string | null
  testItems: string[]
  sampleType: string
  samplingMethod: string
  storageCondition: string
  shelfLifeDays: number | null
  retailPriceCents: number
  /** default = 采购价 × 2 默认规则；merchant = 商家自定义价 */
  priceSource: 'default' | 'merchant'
  available: number
  related: StorefrontRelated[]
}

export async function fetchStorefront(channelCode?: string): Promise<StorefrontProduct[]> {
  return api<StorefrontProduct[]>(
    `/sales-orders/storefront${channelCode ? `?channelCode=${channelCode}` : ''}`,
  )
}

export async function fetchStorefrontDetail(listingId: string): Promise<StorefrontProduct> {
  return api<StorefrontProduct>(`/sales-orders/storefront/${listingId}`)
}

/** 分类筛选项：仅展示当前有商品的分类，顺序与商家端采购页一致 */
export function productCategoryOptions(
  items: StorefrontProduct[],
): Array<{ key: string; label: string }> {
  const available = new Set(items.map((item) => item.category))
  return [
    { key: 'all', label: '全部' },
    ...PRODUCT_CATEGORIES.filter((category) => available.has(category.key)).map((category) => ({
      key: category.key,
      label: category.label,
    })),
  ]
}
