import { Text, View } from '@tarojs/components'

export type SpecItem = {
  label: string
  value?: string | number | null
}

/** 规格参数表：与商家端商品详情同款两列结构，空值自动隐藏 */
export function SpecList({ items }: { items: SpecItem[] }) {
  const visible = items.filter(
    (item) => item.value !== null && item.value !== undefined && `${item.value}`.trim() !== '',
  )
  if (visible.length === 0) {
    return null
  }
  return (
    <View className="spec-list">
      {visible.map((item) => (
        <View key={item.label} className="spec-row">
          <Text className="spec-label">{item.label}</Text>
          <Text className="spec-value">{item.value}</Text>
        </View>
      ))}
    </View>
  )
}
