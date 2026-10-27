import { Text, View } from '@tarojs/components'
import { PROCUREMENT_STATUS_LABELS, statusLabel } from '@mall/shared'

const STATUS_TONE: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  deducted: 'warning',
  pending_shipment: 'warning',
  shipped: 'primary',
  received: 'primary',
  completed: 'success',
  cancelled: 'default',
  after_sale: 'danger',
  refunded: 'default',
}

/**
 * 采购单状态标签（方案 §3.4 StatusTag）：8 态统一色板，
 * 待处理橙 / 进行中蓝 / 已完成绿 / 异常红 / 已关闭灰。
 */
export function StatusTag({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONE[status] ?? 'default'
  return (
    <Text className={`status-tag status-tag-${tone}`}>
      {label ?? statusLabel(PROCUREMENT_STATUS_LABELS, status)}
    </Text>
  )
}

export { STATUS_TONE }
