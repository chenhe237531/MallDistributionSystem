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
    description: '黑曜石底 + 香槟金，高端专业',
    swatch: ['#08080A', '#D4AF37', '#F4EFE4'],
    vars: {
      '--mall-primary': '#d4af37',
      '--mall-primary-hover': '#e3c173',
      '--mall-primary-pressed': '#b8952b',
      '--mall-primary-light': 'rgba(212, 175, 55, 0.14)',
      '--mall-primary-light-pressed': 'rgba(212, 175, 55, 0.22)',
      '--mall-on-primary': '#14110a',
      '--mall-color-price': '#f0c86a',
      '--mall-color-gold': '#d4af37',
      '--mall-success': '#3fbf7f',
      '--mall-success-light': 'rgba(63, 191, 127, 0.14)',
      '--mall-warning': '#e8a33d',
      '--mall-warning-light': 'rgba(232, 163, 61, 0.14)',
      '--mall-danger': '#e4685c',
      '--mall-danger-light': 'rgba(228, 104, 92, 0.14)',
      '--mall-text': '#f4efe4',
      '--mall-text-secondary': '#b3a995',
      '--mall-text-tertiary': '#7c7466',
      '--mall-border': '#2f2a22',
      '--mall-border-light': '#221e18',
      '--mall-card-border': 'rgba(212, 175, 55, 0.14)',
      '--mall-bg': '#08080a',
      '--mall-card': '#141217',
      '--mall-surface-2': '#1b181f',
      '--mall-brand-dark': '#8c6f1e',
      '--mall-hero-text': '#f7edcf',
      '--mall-hero-grad': 'linear-gradient(135deg, #1a1509 0%, #241b0b 55%, #3a2a0e 100%)',
      '--mall-banner-grad': 'linear-gradient(120deg, #141109 0%, #33270f 100%)',
      '--mall-shadow': '0 6px 20px rgba(0, 0, 0, 0.55)',
      '--mall-glow': '0 0 20px rgba(212, 175, 55, 0.18)',
      '--mall-nav-bg': '#08080a',
    },
  },
  classic: {
    key: 'classic',
    name: '经典蓝紫',
    description: '品牌紫 + 浅色卡片，原主题',
    swatch: ['#F7F8FA', '#6E5CFF', '#1F2329'],
    vars: {
      '--mall-primary': '#6e5cff',
      '--mall-primary-hover': '#8f85ff',
      '--mall-primary-pressed': '#4c3ed9',
      '--mall-primary-light': '#efecff',
      '--mall-primary-light-pressed': '#ddd9ff',
      '--mall-on-primary': '#ffffff',
      '--mall-color-price': '#ff4d4f',
      '--mall-color-gold': '#f7c945',
      '--mall-success': '#00b42a',
      '--mall-success-light': '#e8ffea',
      '--mall-warning': '#ff7d00',
      '--mall-warning-light': '#fff7e8',
      '--mall-danger': '#f53f3f',
      '--mall-danger-light': '#ffece8',
      '--mall-text': '#1f2329',
      '--mall-text-secondary': '#646a73',
      '--mall-text-tertiary': '#8f959e',
      '--mall-border': '#e5e6eb',
      '--mall-border-light': '#f2f3f5',
      '--mall-card-border': 'rgba(31, 35, 41, 0.06)',
      '--mall-bg': '#f7f8fa',
      '--mall-card': '#ffffff',
      '--mall-surface-2': '#ffffff',
      '--mall-brand-dark': '#4c3ed9',
      '--mall-hero-text': '#ffffff',
      '--mall-hero-grad': 'linear-gradient(135deg, #4c3ed9 0%, #6e5cff 100%)',
      '--mall-banner-grad': 'linear-gradient(120deg, #2b2350 0%, #4c3ed9 100%)',
      '--mall-shadow': '0 1px 3px rgba(31, 35, 41, 0.05)',
      '--mall-glow': '0 6px 16px rgba(110, 92, 255, 0.28)',
      '--mall-nav-bg': '#4c3ed9',
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
