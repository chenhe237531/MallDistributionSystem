import { Text, View } from '@tarojs/components'
import { formatCents, productCategoryLabel } from '@mall/shared'
import { GoodsThumb } from './GoodsThumb'
import { Icon } from '../Icon'

export type GoodsSummary = {
  id: string
  name: string
  skuCode: string
  supplyPriceCents: number
  retailPriceCents?: number | null
  images?: string[]
  category?: string | null
  testItems?: string[]
  sampleType?: string
}

type Props = {
  product: GoodsSummary
  tags?: string[]
  onOpen?: () => void
  onAdd?: () => void
}

/**
 * 商品卡（方案 §3.4 GoodsCard）：图 + 资质标签 + 名称 + 供货价/建议零售价 + 加购。
 * 首页推荐、采购列表共用，样式由 app.scss `.goods-card` 统一收敛。
 */
export function GoodsCard({ product, tags = [], onOpen, onAdd }: Props) {
  const retail = product.retailPriceCents ?? 0
  return (
    <View className="goods-card" onClick={onOpen}>
      <GoodsThumb src={product.images?.[0]} name={product.name} size="md" />
      <View className="goods-card-info">
        <Text className="goods-card-name">{product.name}</Text>
        <View className="goods-card-tags">
          <Text className="goods-card-tag goods-card-tag-cat">{productCategoryLabel(product.category)}</Text>
          {tags.slice(0, 2).map((tag) => (
            <Text key={tag} className="goods-card-tag">
              {tag}
            </Text>
          ))}
        </View>
        <View className="goods-card-bottom">
          <View className="goods-card-price-wrap">
            <Text className="goods-card-price">
              <Text className="goods-card-price-symbol">¥</Text>
              {formatCents(product.supplyPriceCents)}
            </Text>
            {retail > product.supplyPriceCents ? (
              <Text className="goods-card-retail">建议零售 ¥{formatCents(retail)}</Text>
            ) : null}
          </View>
          <View
            className="goods-card-action"
            onClick={(event) => {
              event.stopPropagation()
              onAdd?.()
            }}
          >
            <Icon name="cart" size={15} />
          </View>
        </View>
      </View>
    </View>
  )
}
