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
  violet6: '#6E5CFF',
  violet7: '#4C3ED9',
  violet5: '#8F85FF',
  violet1: '#EFECFF',
  violet2: '#DDD9FF',
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

/* ===== 主题包（黑金 / 经典），商家端主题切换的唯一来源 =====
   落地：apps/mini-b/src/app.scss 的 .theme-gold / .theme-classic 变量块与本表逐项同步；
   页面样式只引用 var(--mall-*)，不得写死色值。 */

export type ThemeKey = 'gold' | 'classic'

/** 默认主题：黑金（产品需求：黑金为默认，经典保留为可选） */
export const DEFAULT_THEME: ThemeKey = 'gold'

export type ThemePack = {
  key: ThemeKey
  name: string
  description: string
  /** 主题预览色（入口卡片使用：[底色, 主色, 文字色]） */
  swatch: [string, string, string]
  vars: Record<string, string>
}

export const themePacks: Record<ThemeKey, ThemePack> = {
  gold: {
    key: 'gold',
    name: '曜石黑金',
    description: '深曜石底 + 克制香槟金，专业稳重',
    swatch: ['#0B0C0E', '#D0AD4E', '#F1EEE7'],
    vars: {
      '--mall-primary': '#d0ad4e',
      '--mall-primary-hover': '#e2c273',
      '--mall-primary-pressed': '#af8e35',
      '--mall-primary-light': 'rgba(208, 173, 78, 0.12)',
      '--mall-primary-light-pressed': 'rgba(208, 173, 78, 0.2)',
      '--mall-on-primary': '#12100a',
      '--mall-color-price': '#e9c36a',
      '--mall-color-gold': '#d0ad4e',
      '--mall-success': '#4fbd88',
      '--mall-success-light': 'rgba(79, 189, 136, 0.14)',
      '--mall-warning': '#e8a33d',
      '--mall-warning-light': 'rgba(232, 163, 61, 0.14)',
      '--mall-danger': '#e4685c',
      '--mall-danger-light': 'rgba(228, 104, 92, 0.14)',
      '--mall-text': '#f1eee7',
      '--mall-text-secondary': '#c1b9ab',
      '--mall-text-tertiary': '#918a7d',
      '--mall-border': '#2b2a25',
      '--mall-border-light': '#202124',
      '--mall-border-strong': '#4b4332',
      '--mall-card-border': 'rgba(208, 173, 78, 0.1)',
      '--mall-bg': '#0b0c0e',
      '--mall-card': '#141518',
      '--mall-surface-2': '#1b1c20',
      '--mall-surface-3': '#232428',
      '--mall-surface-raised': '#1b1c20',
      '--mall-surface-sunken': '#101114',
      '--mall-tabbar-bg': '#101114',
      '--mall-primary-grad': 'linear-gradient(135deg, #e2c273 0%, #d0ad4e 52%, #af8e35 100%)',
      '--mall-brand-dark': '#7f6624',
      '--mall-hero-text': '#f1eee7',
      '--mall-hero-grad': 'linear-gradient(135deg, #15140f 0%, #201d13 58%, #2b2515 100%)',
      '--mall-banner-grad': 'linear-gradient(120deg, #151611 0%, #252115 100%)',
      '--mall-shadow': '0 10px 28px rgba(0, 0, 0, 0.32)',
      '--mall-glow': '0 8px 20px rgba(208, 173, 78, 0.12)',
      '--mall-nav-bg': '#0b0c0e',
      '--mall-focus-ring': 'rgba(208, 173, 78, 0.28)',
      '--mall-disabled-bg': 'rgba(208, 173, 78, 0.12)',
      '--mall-disabled-text': '#777166',
      '--mall-media-bg': '#f3f1ec',
      '--mall-overlay': 'rgba(4, 5, 6, 0.72)',
      '--mall-shell-max': '520px',
    },
  },
  classic: {
    key: 'classic',
    name: '经典蓝紫',
    description: '沉稳蓝紫 + 轻盈浅色表面，清晰耐用',
    swatch: ['#F5F6FA', '#5B4DE7', '#1D2030'],
    vars: {
      '--mall-primary': '#5b4de7',
      '--mall-primary-hover': '#746af2',
      '--mall-primary-pressed': '#4438bd',
      '--mall-primary-light': '#eeecff',
      '--mall-primary-light-pressed': '#dedaff',
      '--mall-on-primary': '#ffffff',
      '--mall-color-price': '#d84d54',
      '--mall-color-gold': '#d0ad4e',
      '--mall-success': '#15965a',
      '--mall-success-light': '#e8f8f0',
      '--mall-warning': '#d97912',
      '--mall-warning-light': '#fff5e8',
      '--mall-danger': '#d84d54',
      '--mall-danger-light': '#ffeded',
      '--mall-text': '#1d2030',
      '--mall-text-secondary': '#656b7d',
      '--mall-text-tertiary': '#9298a8',
      '--mall-border': '#e4e6ee',
      '--mall-border-light': '#eef0f6',
      '--mall-border-strong': '#cfd3df',
      '--mall-card-border': 'rgba(29, 32, 48, 0.07)',
      '--mall-bg': '#f5f6fa',
      '--mall-card': '#ffffff',
      '--mall-surface-2': '#f8f9fc',
      '--mall-surface-3': '#eef0f6',
      '--mall-surface-raised': '#f8f9fc',
      '--mall-surface-sunken': '#eef0f6',
      '--mall-tabbar-bg': '#ffffff',
      '--mall-primary-grad': 'linear-gradient(135deg, #746af2 0%, #5b4de7 52%, #4438bd 100%)',
      '--mall-brand-dark': '#4438bd',
      '--mall-hero-text': '#ffffff',
      '--mall-hero-grad': 'linear-gradient(135deg, #4036a2 0%, #5b4de7 100%)',
      '--mall-banner-grad': 'linear-gradient(120deg, #312a78 0%, #5144c7 100%)',
      '--mall-shadow': '0 6px 18px rgba(31, 35, 55, 0.06)',
      '--mall-glow': '0 8px 20px rgba(91, 77, 231, 0.18)',
      '--mall-nav-bg': '#4438bd',
      '--mall-focus-ring': 'rgba(91, 77, 231, 0.24)',
      '--mall-disabled-bg': '#e9eaf1',
      '--mall-disabled-text': '#a7acba',
      '--mall-media-bg': '#f1f3f7',
      '--mall-overlay': 'rgba(23, 25, 32, 0.5)',
      '--mall-shell-max': '520px',
    },
  },
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
