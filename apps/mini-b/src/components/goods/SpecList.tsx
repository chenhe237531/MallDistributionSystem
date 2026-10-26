import { Text, View } from '@tarojs/components'

export type SpecItem = { label: string; value?: string | null }

/** 规格参数键值表（方案 §3.4 SpecList）：详情页与结算确认复用 */
export function SpecList({ items }: { items: SpecItem[] }) {
  const visible = items.filter((item) => item.value && item.value !== '—')
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
