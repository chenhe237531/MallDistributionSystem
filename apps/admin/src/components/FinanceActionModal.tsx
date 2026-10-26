import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Button, Descriptions, Modal, Space, Typography } from 'antd'
import { CheckCircleFilled } from '@ant-design/icons'
import { designTokens } from '@mall/shared'

const { Text } = Typography

/** 弹窗内的一行摘要 / 金额 */
export type FinanceRow = {
  label: string
  /** 已按 §5.1 格式化好的展示值（金额用 moneyRow 生成） */
  value: string
  strong?: boolean
  /** 负向金额（如差异、冲回）用错误色；红色仅用于错误语义 */
  danger?: boolean
}

/** 成功后的结果摘要（FR-A2 结果态） */
export type FinanceResult = {
  title: string
  rows: FinanceRow[]
}

/** 金额行：统一「¥ + formatCents」口径 */
export function moneyRow(label: string, cents: number, opts?: Omit<FinanceRow, 'label' | 'value'>): FinanceRow {
  const sign = cents < 0 ? '-' : ''
  return { label, value: `${sign}¥${Math.abs(cents / 100).toFixed(2)}`, ...opts }
}

type Props = {
  open: boolean
  title: string
  /** 操作对象摘要：单号 / 周期 / 主体 */
  objectRows: FinanceRow[]
  /** 关键金额（表格化展示） */
  amountRows?: FinanceRow[]
  /** 后果说明（不可逆变更必须给出） */
  consequence?: string
  /** 确认按钮文案，须写明动作，如「确认结清」 */
  confirmText: string
  /** 表单字段等额外内容（确认阶段渲染，状态提升到父组件以保留已填内容） */
  children?: ReactNode
  /** 按钮禁用及原因说明（如应付为 0 且无票证不可结清） */
  disabledReason?: string
  /** 提交回调；抛错时保留弹窗与已填内容并展示后端错误文案 */
  onConfirm: () => Promise<void>
  /** 非 null 时切换到结果摘要态 */
  result: FinanceResult | null
  onClose: () => void
  width?: number
}

/**
 * FR-A2 统一资金操作弹窗：对象摘要 → 关键金额 → 后果说明 → 确认 → 结果摘要。
 * 执行中按钮 loading 且防重复；失败保留弹窗内容并展示后端错误。
 */
export default function FinanceActionModal({
  open,
  title,
  objectRows,
  amountRows,
  consequence,
  confirmText,
  children,
  disabledReason,
  onConfirm,
  result,
  onClose,
  width = 480,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setError('')
    }
  }, [open])

  // 进入结果态后重置提交中状态
  useEffect(() => {
    if (result) {
      setSubmitting(false)
    }
  }, [result])

  const phase: 'confirm' | 'result' = result ? 'result' : 'confirm'

  const handleConfirm = async () => {
    if (submitting) {
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onConfirm()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={title}
      open={open}
      width={width}
      maskClosable={false}
      onCancel={() => {
        if (!submitting) {
          onClose()
        }
      }}
      footer={
        phase === 'result' ? (
          <Button type="primary" onClick={onClose}>
            关闭
          </Button>
        ) : (
          <Space>
            <Button disabled={submitting} onClick={onClose}>
              取消
            </Button>
            {disabledReason ? (
              <Button type="primary" disabled title={disabledReason}>
                {confirmText}
              </Button>
            ) : (
              <Button type="primary" loading={submitting} onClick={() => void handleConfirm()}>
                {confirmText}
              </Button>
            )}
          </Space>
        )
      }
    >
      {phase === 'result' && result ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <CheckCircleFilled style={{ fontSize: 40, color: designTokens.colorSuccess }} />
          <p style={{ margin: '12px 0 4px', fontSize: 16, fontWeight: 600 }}>{result.title}</p>
          <Descriptions
            size="small"
            column={1}
            layout="horizontal"
            style={{ textAlign: 'left', marginTop: 12 }}
            items={result.rows.map((row) => ({
              key: row.label,
              label: row.label,
              children: (
                <Text
                  strong={row.strong}
                  type={row.danger ? 'danger' : undefined}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {row.value}
                </Text>
              ),
            }))}
          />
        </div>
      ) : (
        <Space direction="vertical" size={12} style={{ display: 'flex' }}>
          {error ? (
            <Alert type="error" showIcon message={error} />
          ) : null}
          <Descriptions
            size="small"
            column={1}
            bordered
            items={objectRows.map((row) => ({
              key: row.label,
              label: row.label,
              children: (
                <Text
                  strong={row.strong}
                  type={row.danger ? 'danger' : undefined}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {row.value}
                </Text>
              ),
            }))}
          />
          {amountRows && amountRows.length > 0 ? (
            <Descriptions
              size="small"
              column={1}
              bordered
              items={amountRows.map((row) => ({
                key: row.label,
                label: row.label,
                children: (
                  <Text
                    strong={row.strong}
                    type={row.danger ? 'danger' : undefined}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {row.value}
                  </Text>
                ),
              }))}
            />
          ) : null}
          {consequence ? (
            <Alert
              type="warning"
              showIcon
              message={consequence}
              style={{ fontSize: 13 }}
            />
          ) : null}
          {disabledReason ? (
            <Alert type="info" showIcon message={disabledReason} style={{ fontSize: 13 }} />
          ) : null}
          {children}
        </Space>
      )}
    </Modal>
  )
}
