import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import { resolveAsset } from '../lib/api'

type Props = {
  /** 相对路径 /uploads/... 或绝对 URL */
  src?: string | null
  /** 无图或加载失败时的品牌占位首字 */
  name: string
  className?: string
  mode?: 'aspectFill' | 'aspectFit' | 'widthFix'
}

/**
 * 商品图统一入口：相对路径补全、加载失败/无图时展示品牌占位，保证任何脏数据不破版。
 * 与商家端 GoodsThumb 同一套兜底策略。
 */
export function GoodsImage({ src, name, className = '', mode = 'aspectFill' }: Props) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  const url = resolveAsset(src)
  const classes = `goods-image ${className}`.trim()

  if (!url || failed) {
    return (
      <View className={`${classes} goods-image-fallback`}>
        <Text className="goods-image-initial">{name.slice(0, 1)}</Text>
      </View>
    )
  }

  return (
    <Image
      className={classes}
      src={url}
      mode={mode}
      lazyLoad
      onError={() => setFailed(true)}
    />
  )
}
