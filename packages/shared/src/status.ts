/**
 * 业务状态中文标签与语义色调（FR-DS / FR-X 配套）。
 * 小程序端 Tag 直接展示状态原值属于体验缺陷，统一在此维护：
 * 页面展示用 LABELS，颜色语义用 TONES（primary/success/warning/danger/default）。
 * 状态值来源：prisma/schema.prisma 各 enum，勿手写臆造。
 */

export type StatusTone = 'primary' | 'success' | 'warning' | 'danger' | 'default'

/** 兜底：未知状态原样返回 */
export function statusLabel(labels: Record<string, string>, value: string | null | undefined): string {
  if (value == null) {
    return '—'
  }
  return labels[value] ?? value
}

export const SALES_ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: '待支付',
  paid: '已支付',
  pending_shipment: '待发货',
  shipped: '已发货',
  pending_sampling: '待采样',
  testing: '检测中',
  report_ready: '报告已出',
  completed: '已完成',
  cancelled: '已取消',
  refunding: '退款中',
  refunded: '已退款',
  after_sale: '售后中',
}

export const SALES_ORDER_STATUS_TONES: Record<string, StatusTone> = {
  pending_payment: 'warning',
  paid: 'success',
  pending_shipment: 'primary',
  shipped: 'primary',
  pending_sampling: 'primary',
  testing: 'primary',
  report_ready: 'success',
  completed: 'default',
  cancelled: 'default',
  refunding: 'danger',
  refunded: 'danger',
  after_sale: 'danger',
}

export const PROCUREMENT_STATUS_LABELS: Record<string, string> = {
  deducted: '已扣款',
  pending_shipment: '待发货',
  shipped: '已发货',
  received: '已收货',
  completed: '已完成',
  cancelled: '已取消',
  after_sale: '售后中',
  refunded: '已退款',
}

export const PROCUREMENT_STATUS_TONES: Record<string, StatusTone> = {
  deducted: 'primary',
  pending_shipment: 'warning',
  shipped: 'primary',
  received: 'success',
  completed: 'default',
  cancelled: 'default',
  after_sale: 'danger',
  refunded: 'danger',
}

export const REPORT_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_review: '待复核',
  published: '已发布',
  corrected: '已更正',
  archived: '已归档',
}

export const REPORT_STATUS_TONES: Record<string, StatusTone> = {
  draft: 'default',
  pending_review: 'warning',
  published: 'success',
  corrected: 'primary',
  archived: 'default',
}

export const COMMISSION_STATUS_LABELS: Record<string, string> = {
  estimated: '预估中',
  pending_reconciliation: '待对账',
  reconciling: '对账中',
  reconciled: '已对账',
  settled: '已结清',
  invalid: '已作废',
  disputed: '有差异',
}

export const COMMISSION_STATUS_TONES: Record<string, StatusTone> = {
  estimated: 'warning',
  pending_reconciliation: 'primary',
  reconciling: 'primary',
  reconciled: 'success',
  settled: 'success',
  invalid: 'default',
  disputed: 'danger',
}

export const STATEMENT_STATUS_LABELS: Record<string, string> = {
  pending: '待对账',
  reconciling: '对账中',
  reconciled: '已对账',
  settled: '已结清',
  disputed: '有差异',
}

export const STATEMENT_STATUS_TONES: Record<string, StatusTone> = {
  pending: 'warning',
  reconciling: 'primary',
  reconciled: 'primary',
  settled: 'success',
  disputed: 'danger',
}

export const RECHARGE_STATUS_LABELS: Record<string, string> = {
  pending: '待入账',
  pending_review: '待人工核验',
  credited: '已入账',
  rejected: '已拒绝',
}

export const RECHARGE_STATUS_TONES: Record<string, StatusTone> = {
  pending: 'warning',
  pending_review: 'warning',
  credited: 'success',
  rejected: 'default',
}

export const CLAIM_STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已拒绝',
}

export const CLAIM_STATUS_TONES: Record<string, StatusTone> = {
  pending: 'warning',
  confirmed: 'success',
  rejected: 'danger',
}

export const TRAINING_STATUS_LABELS: Record<string, string> = {
  not_started: '未开始',
  learning: '学习中',
  pending_exam: '待考试',
  passed: '已通过',
  expired: '已过期',
}

export const TRAINING_STATUS_TONES: Record<string, StatusTone> = {
  not_started: 'default',
  learning: 'primary',
  pending_exam: 'warning',
  passed: 'success',
  expired: 'default',
}
