/**
 * 设计令牌（FR-DS）——三端颜色 / 字号 / 间距 / 圆角的唯一来源。
 *
 * 分层：
 *  - 基础令牌：色板、字号阶梯、4px 基数间距阶梯、圆角阶梯
 *  - 语义令牌：designTokens（主色、成功 / 警告 / 错误、文本一级 / 二级、边框、背景）
 *
 * 落地方式：
 *  - admin：经 apps/admin/src/theme.ts 映射到 antd ConfigProvider theme token
 *  - mini-b / mini-c：映射到 NutUI CSS 变量与 --mall-* 自定义属性
 *    （两端的 app.scss 顶部声明块与本文件保持同步，变量名以 NutUI dist 样式表为准）
 * 令牌变更必须三端同步评审。
 */

/** 基础色板（仅语义令牌引用，页面不得直接使用） */
export const palette = {
  blue6: '#1677ff',
  blue7: '#0958d9',
  blue5: '#4096ff',
  blue1: '#e6f4ff',
  blue2: '#bae0ff',
  green6: '#00b42a',
  green1: '#e8ffea',
  orange6: '#ff7d00',
  orange1: '#fff7e8',
  red6: '#f53f3f',
  red1: '#ffece8',
  gray10: '#1f2329',
  gray6: '#646a73',
  gray5: '#8f959e',
  gray3: '#e5e6eb',
  gray2: '#f2f3f5',
  gray1: '#f7f8fa',
  white: '#ffffff',
} as const

/** 语义令牌：页面只允许引用这一层 */
export const designTokens = {
  // 颜色
  colorPrimary: palette.blue6,
  colorPrimaryHover: palette.blue5,
  colorPrimaryActive: palette.blue7,
  colorPrimaryLight: palette.blue1,
  colorPrimaryLightPressed: palette.blue2,
  colorSuccess: palette.green6,
  colorSuccessLight: palette.green1,
  colorWarning: palette.orange6,
  colorWarningLight: palette.orange1,
  colorError: palette.red6,
  colorErrorLight: palette.red1,
  colorText: palette.gray10,
  colorTextSecondary: palette.gray6,
  colorTextTertiary: palette.gray5,
  colorBorder: palette.gray3,
  colorBorderLight: palette.gray2,
  colorBgLayout: palette.gray1,
  colorBgContainer: palette.white,
  // 布局深色（admin 顶栏 / 小程序 hero 渐变深端）
  colorBrandDark: '#0f2540',

  // 字号阶梯（px）
  fontSizeXs: 10,
  fontSizeSm: 12,
  fontSizeMd: 14,
  fontSizeLg: 16,
  fontSizeXl: 20,
  fontSizeXxl: 24,

  // 间距阶梯（4px 基数）
  spacing1: 4,
  spacing2: 8,
  spacing3: 12,
  spacing4: 16,
  spacing5: 20,
  spacing6: 24,

  // 圆角阶梯
  radiusSm: 4,
  radiusMd: 8,
  radiusLg: 12,
  radiusFull: 999,

  // 字体
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif",
} as const

export type DesignTokens = typeof designTokens

/**
 * 语义令牌 → NutUI CSS 变量映射（变量名以 NutUI dist/style.css 实际定义为准）。
 * mini-b / mini-c 的 app.scss 按此映射静态声明，值必须与本表一致。
 */
export const NUTUI_THEME_VAR_MAP: Record<string, string> = {
  '--nutui-color-primary': designTokens.colorPrimary,
  '--nutui-color-primary-stop-1': designTokens.colorPrimary,
  '--nutui-color-primary-stop-2': designTokens.colorPrimaryActive,
  '--nutui-color-primary-text': designTokens.colorBgContainer,
  '--nutui-color-primary-pressed': designTokens.colorPrimaryActive,
  '--nutui-color-primary-disabled': palette.blue2,
  '--nutui-color-primary-disabled-special': designTokens.colorPrimaryLightPressed,
  '--nutui-color-primary-light': designTokens.colorPrimaryLight,
  '--nutui-color-primary-light-pressed': designTokens.colorPrimaryLightPressed,
  '--nutui-brand-1': designTokens.colorPrimaryLight,
  '--nutui-brand-6': designTokens.colorPrimary,
  '--nutui-brand-stop-1': designTokens.colorPrimaryHover,
  '--nutui-brand-stop-2': designTokens.colorPrimaryActive,
  '--nutui-color-title': designTokens.colorText,
  '--nutui-color-text': designTokens.colorTextSecondary,
  '--nutui-color-text-help': designTokens.colorTextTertiary,
  '--nutui-color-border': designTokens.colorBorder,
  '--nutui-color-background': designTokens.colorBgLayout,
  '--nutui-button-border-radius': `${designTokens.radiusMd}px`,
}

/** 语义令牌 → --mall-* 自定义属性（小程序页面样式引用这一层，不得写死色值） */
export const MALL_CSS_VAR_MAP: Record<string, string> = {
  '--mall-primary': designTokens.colorPrimary,
  '--mall-primary-hover': designTokens.colorPrimaryHover,
  '--mall-primary-pressed': designTokens.colorPrimaryActive,
  '--mall-primary-light': designTokens.colorPrimaryLight,
  '--mall-primary-light-pressed': designTokens.colorPrimaryLightPressed,
  '--mall-success': designTokens.colorSuccess,
  '--mall-warning': designTokens.colorWarning,
  '--mall-warning-light': designTokens.colorWarningLight,
  '--mall-danger': designTokens.colorError,
  '--mall-danger-light': designTokens.colorErrorLight,
  '--mall-text': designTokens.colorText,
  '--mall-text-secondary': designTokens.colorTextSecondary,
  '--mall-text-tertiary': designTokens.colorTextTertiary,
  '--mall-border': designTokens.colorBorder,
  '--mall-bg': designTokens.colorBgLayout,
  '--mall-card': designTokens.colorBgContainer,
  '--mall-brand-dark': designTokens.colorBrandDark,
}
