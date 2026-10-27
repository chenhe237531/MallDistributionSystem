/**
 * 商品分类（结构化字段 Product.category 的唯一来源，三端共用）。
 * 依据 docs/商家小程序整体优化产品开发方案.md §3.3：
 * 分类落库后，采购页侧栏不再依赖商品名关键词猜测归类。
 */

export type ProductCategoryKey =
  | 'gut_test'
  | 'fmt'
  | 'transplant_service'
  | 'bowel_prep'
  | 'adjunct'
  | 'consumer_health'
  | 'customized'
  | 'training_kit'

export type ProductCategoryMeta = {
  key: ProductCategoryKey
  label: string
  desc: string
  /** 采购页二级 pill 的关键词（仅用于二级筛选，一级分类以 category 字段为准） */
  subs: Array<{ key: string; label: string; keywords: string[] }>
}

export const PRODUCT_CATEGORIES: ProductCategoryMeta[] = [
  {
    key: 'gut_test',
    label: '检测服务',
    desc: '肠道菌群基因组检测（标准版 / 极速版）',
    subs: [
      { key: 'std', label: '标准版', keywords: ['标准版'] },
      { key: 'exp', label: '极速版', keywords: ['极速版'] },
      { key: 'home', label: '家庭采样', keywords: ['家庭', '采样'] },
    ],
  },
  {
    key: 'fmt',
    label: '移植产品',
    desc: 'FMT 健康人源肠道菌群胶囊 / 升级版 / 菌泥',
    subs: [
      { key: 'cap', label: '胶囊', keywords: ['胶囊'] },
      { key: 'paste', label: '菌泥', keywords: ['菌泥'] },
    ],
  },
  {
    key: 'transplant_service',
    label: '移植服务',
    desc: '精准菌群移植服务（购买后开通移植后健康助手）',
    subs: [],
  },
  {
    key: 'bowel_prep',
    label: '清肠用药',
    desc: '移植前肠道准备用药（聚乙二醇电解质散）',
    subs: [],
  },
  {
    key: 'adjunct',
    label: '配套辅剂',
    desc: '移植配套专用辅剂',
    subs: [],
  },
  {
    key: 'consumer_health',
    label: '健康消费品',
    desc: '英诺衡 / 英诺畅 / 英诺纤',
    subs: [
      { key: 'heng', label: '英诺衡', keywords: ['英诺衡'] },
      { key: 'chang', label: '英诺畅', keywords: ['英诺畅'] },
      { key: 'xian', label: '英诺纤', keywords: ['英诺纤'] },
    ],
  },
  {
    key: 'customized',
    label: '定制产品',
    desc: '定制化活菌胶囊 / 益生菌元液',
    subs: [],
  },
  {
    key: 'training_kit',
    label: '采样耗材',
    desc: '采样盒 / 耗材等',
    subs: [],
  },
]

export const PRODUCT_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((item) => [item.key, item.label]),
)

/** 移植服务类目：购买后自动开通健康助手（TransplantJourney） */
export const TRANSPLANT_SERVICE_CATEGORY = 'transplant_service'
/** 清肠用药类目：健康助手清肠卡平台购买路径的商品来源 */
export const BOWEL_PREP_CATEGORY = 'bowel_prep'

export function productCategoryLabel(key?: string | null): string {
  if (!key) {
    return '未分类'
  }
  return PRODUCT_CATEGORY_LABELS[key] ?? key
}

export function isProductCategoryKey(value: unknown): value is ProductCategoryKey {
  return typeof value === 'string' && PRODUCT_CATEGORIES.some((item) => item.key === value)
}

/* ============================================================
 * C 端售价规则（方案 v1.2 §3）
 * ============================================================ */

/**
 * 默认加价倍数：C 端默认售价 = 采购价 × 2，即商家默认毛利率 50%。
 * 商家可在「商品定价」页自定义，最终 C 端展示以 MerchantProduct.retailPriceCents 为准。
 */
export const DEFAULT_RETAIL_MARKUP = 2

/** 按采购价推算的默认 C 端售价（分）。 */
export function defaultRetailPriceCents(supplyPriceCents: number): number {
  return Math.round(supplyPriceCents * DEFAULT_RETAIL_MARKUP)
}

/** 毛利率（万分比）：(售价 - 采购价) / 售价；售价为 0 时返回 0。 */
export function grossMarginBps(supplyPriceCents: number, retailPriceCents: number): number {
  if (retailPriceCents <= 0) {
    return 0
  }
  return Math.round(((retailPriceCents - supplyPriceCents) / retailPriceCents) * 10000)
}
