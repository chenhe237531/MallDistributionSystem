export type SampleStatus =
  | 'generated'
  | 'activated'
  | 'pending_mail'
  | 'in_transit'
  | 'received_by_lab'
  | 'testing'
  | 'report_generated'
  | 'published'
  | 'abnormal'
  | 'voided'

export const SAMPLE_STATUS_LABELS: Record<SampleStatus, string> = {
  generated: '待激活',
  activated: '已激活',
  pending_mail: '待寄回',
  in_transit: '运输中',
  received_by_lab: '实验室已收样',
  testing: '检测中',
  report_generated: '报告已生成',
  published: '报告已发布',
  abnormal: '样本异常',
  voided: '已作废',
}

export const RELATIONSHIP_LABELS: Record<string, string> = {
  self: '本人',
  spouse: '配偶',
  parent: '父母',
  child: '子女',
  other: '其他',
}

/** 五步向导节点（§3.2） */
export const SAMPLE_STEPS = ['样本绑定', '填写问卷', '样本寄回', '物流信息', '样本收到'] as const

/** 状态 → 当前节点；abnormal/voided 返回 -1 表示步骤条冻结 */
export function stepIndexForStatus(
  status: SampleStatus | 'binding',
  questionnaireDone = false,
): number {
  if (status === 'binding' || status === 'generated') {
    return 0
  }
  switch (status) {
    case 'activated':
      return questionnaireDone ? 2 : 1
    case 'pending_mail':
      return 2
    case 'in_transit':
      return 3
    case 'received_by_lab':
    case 'testing':
    case 'report_generated':
    case 'published':
      return 4
    default:
      return -1
  }
}

/** 样本事件 → 时间线文案 */
export const SAMPLE_EVENT_LABELS: Record<string, string> = {
  activated: '样本绑定成功',
  questionnaire_done: '健康问卷已提交',
  mailed: '样本已寄出',
  received_by_lab: '实验室已收样',
  testing: '开始检测',
  report_generated: '报告已生成',
  published: '报告已发布',
  abnormal_received: '收样异常',
  abnormal: '样本异常',
  resample: '已安排补采',
  voided: '样本已作废',
}

export type SampleEvent = {
  id: string
  type: string
  note: string | null
  createdAt: string
}

export type SampleRecord = {
  id: string
  sampleNo: string
  status: SampleStatus
  questionnaire: Record<string, unknown> | null
  sampledAt: string | null
  contactPhone: string | null
  relationship: string | null
  examineeAge: number | null
  remark: string | null
  trackingNo: string | null
  activatedAt: string
  receivedAt: string | null
  createdAt: string
  boxCode: { code: string; productName?: string }
  events: SampleEvent[]
}

/** 问卷是否已提交（questionnaire 非空） */
export function isQuestionnaireDone(sample: SampleRecord): boolean {
  return Boolean(sample.questionnaire && Object.keys(sample.questionnaire).length > 0)
}
