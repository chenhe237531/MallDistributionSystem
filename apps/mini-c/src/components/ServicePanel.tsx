import { Text, View } from '@tarojs/components'
import { Button as NutButton } from '@nutui/nutui-react-taro'
import { SERVICE_INFO } from '../lib/content'

/**
 * 联系客服半屏面板（方案 §4.6）。
 * 客服电话 / 微信 / 工作时间未取得前一律占位，不编造号码。
 */
export function ServicePanel({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  if (!visible) {
    return null
  }

  return (
    <View className="sheet-mask" onClick={onClose}>
      <View className="sheet-panel" onClick={(event) => event.stopPropagation()}>
        <View className="sheet-handle" />
        <Text className="sheet-title">联系客服</Text>
        {SERVICE_INFO.map((item) => (
          <View key={item.label} className="sheet-row">
            <Text className="sheet-row-label">{item.label}</Text>
            <Text className="sheet-row-value">{item.value}</Text>
          </View>
        ))}
        <Text className="muted">{SERVICE_INFO_NOTE}</Text>
        <View className="field-gap" />
        <NutButton block type="primary" onClick={onClose}>
          我知道了
        </NutButton>
      </View>
    </View>
  )
}

const SERVICE_INFO_NOTE = '客服信息即将上线，届时可在此拨打客服电话或复制客服微信。'
