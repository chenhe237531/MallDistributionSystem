import { Button as TaroButton, View } from '@tarojs/components'
import type { ReactNode } from 'react'
import { isButtonInert } from './interaction'

const BUTTON_A11Y_ROLE = { role: 'button', ariaRole: 'button' } as const

/**
 * 统一按钮组件（黑金规范 §5）。
 *
 * 类型（variant）：
 * - primary：主按钮，金色渐变填充 + 深色文字（--mall-primary-grad / --mall-on-primary）
 * - outline：描金按钮，金色描边黑底，用于与填充金按钮同屏的次核心操作（避免"双金抢戏"）
 * - secondary：次级按钮，深灰底 + 暖白文字
 * - text：文字按钮，金色文字，用于"查看更多 / 编辑"等弱操作
 * - danger：危险按钮，保持红色语义，不得镀金
 *
 * 尺寸（size）：lg 48px / md 40px / sm 32px，全圆角；触控热区以高度为准（lg 满足 ≥88rpx）。
 * 状态：按压（:active 压暗 + 缩放 0.98）、禁用（disabled）、加载（loading，spinner 随文字色）。
 * 样式只引用 var(--mall-*)，黑金 / 经典主题均可用，不写死色值。
 */

export type ButtonVariant = 'primary' | 'outline' | 'secondary' | 'text' | 'danger'
export type ButtonSize = 'lg' | 'md' | 'sm'

export type ButtonProps = {
  /** 按钮类型，默认 primary */
  variant?: ButtonVariant
  /** 尺寸，默认 md */
  size?: ButtonSize
  /** 是否撑满父容器宽度 */
  block?: boolean
  /** 禁用态：不可点击，视觉降级 */
  disabled?: boolean
  /** 加载态：显示 spinner 并锁定宽度，防文字切换跳动 */
  loading?: boolean
  className?: string
  /** 无可见文字或文案会切换时，为读屏提供稳定名称 */
  ariaLabel?: string
  children?: ReactNode
  onClick?: () => void
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  loading = false,
  className = '',
  ariaLabel,
  children,
  onClick,
}: ButtonProps) {
  const inert = isButtonInert(disabled, loading)

  const cls = [
    'm-btn',
    `m-btn-${variant}`,
    `m-btn-${size}`,
    block ? 'm-btn-block' : '',
    disabled ? 'm-btn-disabled' : '',
    loading ? 'm-btn-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <TaroButton
      {...BUTTON_A11Y_ROLE}
      className={cls}
      disabled={inert}
      ariaLabel={ariaLabel}
      hoverClass="m-btn-hover"
      onClick={() => {
        if (inert) {
          return
        }
        onClick?.()
      }}
    >
      {loading ? <View className="m-btn-spinner" /> : null}
      {children}
    </TaroButton>
  )
}
