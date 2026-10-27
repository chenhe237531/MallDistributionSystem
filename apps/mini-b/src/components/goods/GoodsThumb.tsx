import { useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import { resolveAsset } from '../../lib/api'

type Props = {
  src?: string | null
  name: string
  /** sm 48 / md 72 / lg 96 / hero 列表主图 */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * 商品缩略图（方案 §3.1）：统一 aspectFill + 无图/加载失败品牌兜底，保证任何数据下不破版。
 */
export function GoodsThumb({ src, name, size = 'md', className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const url = resolveAsset(src)
  const classes = `goods-thumb goods-thumb-${size} ${className}`.trim()

  if (!url || failed) {
    return (
      <View className={`${classes} goods-thumb-fallback`}>
        <Text className="goods-thumb-initial">{name.slice(0, 1)}</Text>
      </View>
    )
  }

  return (
    <Image
      className={classes}
      src={url}
      mode="aspectFill"
      lazyLoad
      onError={() => setFailed(true)}
    />
  )
}
