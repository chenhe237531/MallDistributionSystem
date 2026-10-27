import { Text, View } from '@tarojs/components'
import {
  SAMPLE_STEPS,
  stepIndexForStatus,
  type SampleStatus,
} from '../lib/sample'

/**
 * 五步步骤条（方案 §5.1）：绑定页 / 问卷页 / 进度页三处复用。
 * 当前节点由样本实际状态推导，而非页面顺序。
 */
export function StepFlow({
  status,
  questionnaireDone = false,
}: {
  status: SampleStatus | 'binding'
  questionnaireDone?: boolean
}) {
  const current = stepIndexForStatus(status, questionnaireDone)

  return (
    <View className="step-flow">
      {SAMPLE_STEPS.map((label, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'future'
        return (
          <View key={label} className={`step-flow-item step-flow-${state}`}>
            <View className="step-flow-dot">
              <Text>{index < current ? '✓' : index + 1}</Text>
            </View>
            <Text className="step-flow-label">{label}</Text>
          </View>
        )
      })}
    </View>
  )
}
