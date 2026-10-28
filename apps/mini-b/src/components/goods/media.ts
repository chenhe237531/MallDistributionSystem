export const GOODS_THUMB_SIZES = ['sm', 'md', 'lg', 'hero'] as const

export type GoodsThumbSize = (typeof GOODS_THUMB_SIZES)[number]
export type GoodsImageMode = 'aspectFill' | 'aspectFit'

/**
 * 列表图需要稳定铺满，详情主图则优先完整呈现包装与文字信息。
 */
export function goodsImageMode(size: GoodsThumbSize): GoodsImageMode {
  return size === 'hero' ? 'aspectFit' : 'aspectFill'
}

/**
 * 对空白名称与复合 Unicode 字符保持稳定，避免兜底图出现空字符或半个代理项。
 */
export function goodsFallbackLabel(name: string): string {
  return Array.from(name.trim())[0] ?? '品'
}
