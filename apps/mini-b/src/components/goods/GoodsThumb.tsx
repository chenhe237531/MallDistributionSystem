import { useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import { resolveAsset } from '../../lib/api'
import {
  goodsFallbackLabel,
  goodsImageMode,
  type GoodsThumbSize,
} from './media'

type Props = {
  src?: string | null
  name: string
  /** sm 48 / md 86 / lg 110 / hero 详情媒体舞台 */
  size?: GoodsThumbSize
  className?: string
}

/**
 * 商品图片：列表统一 aspectFill，详情主图 aspectFit，无图/失败均使用品牌兜底。
 */
export function GoodsThumb({ src, name, size = 'md', className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const url = resolveAsset(src)
  const classes = `goods-thumb goods-thumb-${size} ${className}`.trim()

  if (!url || failed) {
    return (
      <View className={`${classes} goods-thumb-fallback`}>
        <Text className="goods-thumb-initial">{goodsFallbackLabel(name)}</Text>
      </View>
    )
  }

  return (
    <Image
      className={classes}
      src={url}
      mode={goodsImageMode(size)}
      lazyLoad
      onError={() => setFailed(true)}
    />
  )
}
