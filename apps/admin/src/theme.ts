import { designTokens } from '@mall/shared'

/**
 * FR-DS：语义令牌 → antd theme token 映射。
 * admin 全局唯一主题来源，页面不得内联令牌外色值。
 */
export const antdTheme = {
  cssVar: true,
  token: {
    colorPrimary: designTokens.colorPrimary,
    colorInfo: designTokens.colorPrimary,
    colorSuccess: designTokens.colorSuccess,
    colorWarning: designTokens.colorWarning,
    colorError: designTokens.colorError,
    colorText: designTokens.colorText,
    colorTextSecondary: designTokens.colorTextSecondary,
    colorTextTertiary: designTokens.colorTextTertiary,
    colorBorder: designTokens.colorBorder,
    colorBorderSecondary: designTokens.colorBorderLight,
    colorBgLayout: designTokens.colorBgLayout,
    colorBgContainer: designTokens.colorBgContainer,
    borderRadius: designTokens.radiusMd,
    fontFamily: designTokens.fontFamily,
    fontSize: designTokens.fontSizeMd,
  },
} as const

/** ProLayout 布局壳令牌（顶栏 / 侧边菜单），同样取自语义令牌。 */
export const proLayoutToken = {
  header: {
    colorBgHeader: designTokens.colorBrandDark,
    colorTextRightActionsItem: '#e2e8f0',
    /* 深色顶栏：标题与移动端汉堡按钮用浅色（H5 兼容，图标对比度） */
    colorHeaderTitle: '#e2e8f0',
  },
  sider: {
    colorTextMenuSelected: designTokens.colorPrimary,
    colorBgMenuItemSelected: designTokens.colorPrimaryLight,
    colorTextMenuActive: designTokens.colorPrimary,
  },
} as const
