import { Text, View } from '@tarojs/components'
import { StatusTag } from '../goods/StatusTag'

/** 采购单正常流转五节点（方案 §3.5-5a，对齐 ProcurementStatus 枚举） */
const NODES = [
  { key: 'created', label: '提交采购单' },
  { key: 'deducted', label: '预付款扣款' },
  { key: 'shipped', label: '商家发货' },
  { key: 'received', label: '确认收货' },
  { key: 'completed', label: '完成' },
]

/** 侧支状态：不进入正常进度条，单独用状态标签表达 */
const BRANCH_STATUSES = ['cancelled', 'after_sale', 'refunded']

function activeIndex(status: string): number {
  switch (status) {
    case 'deducted':
    case 'pending_shipment':
      return 1
    case 'shipped':
      return 2
    case 'received':
      return 3
    case 'completed':
      return 4
    default:
      return 0
  }
}

type Props = {
  status: string
  /** 紧凑模式：仅进度条，不显示说明文案（列表用） */
  compact?: boolean
}

/**
 * 采购单五节点进度（方案 §3.5-5a）：提交 → 扣款 → 发货 → 收货 → 完成。
 * 待发货并入「预付款扣款」后一节点展示；售后/退款/取消走侧支状态标签。
 */
export function ProcurementProgress({ status, compact = false }: Props) {
  if (BRANCH_STATUSES.includes(status)) {
    return (
      <View className="proc-progress proc-progress-branch">
        <StatusTag status={status} />
        {!compact ? <Text className="proc-progress-hint">该采购单已进入售后 / 关闭流程，如有疑问请联系商务。</Text> : null}
      </View>
    )
  }

  const current = activeIndex(status)
  return (
    <View className="proc-progress">
      <View className="proc-progress-track">
        {NODES.map((node, index) => {
          const state = index < current ? 'done' : index === current ? 'active' : 'todo'
          return (
            <View key={node.key} className="proc-progress-node">
              <View className={`proc-progress-dot proc-progress-dot-${state}`}>
                {state === 'done' ? <Text className="proc-progress-check">✓</Text> : null}
              </View>
              {index < NODES.length - 1 ? (
                <View className={`proc-progress-line ${index < current ? 'proc-progress-line-done' : ''}`} />
              ) : null}
              <Text className={`proc-progress-label proc-progress-label-${state}`}>{node.label}</Text>
            </View>
          )
        })}
      </View>
      {!compact ? (
        <Text className="proc-progress-hint">
          当前状态：{status === 'pending_shipment' ? '待商家发货' : NODES[current]?.label}
          {status === 'deducted' ? '（预付款已扣款，等待发货）' : ''}
        </Text>
      ) : null}
    </View>
  )
}
