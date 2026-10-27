import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { DEFAULT_THEME, type ThemeKey, type ThemePack, themePacks } from '@mall/shared'

/**
 * 主题运行时（商家端）。
 *
 * 机制：主题值 → CSS 变量作用域（.theme-gold / .theme-classic）→ 页面根容器挂 class。
 * - 默认黑金（shared DEFAULT_THEME），经典蓝紫完整保留用于回退；
 * - 选择持久化到 storage，跨页通过订阅同步；
 * - H5 额外同步 html/body（NutUI 弹层 Portal 到 body 也需要主题变量）；
 *   小程序额外同步导航栏与窗口底色。
 * 说明：变量只在 app.scss 的 .theme-* 块中定义，页面不得写死色值。
 */

const STORAGE_KEY = 'mall_b_theme'

let current: ThemeKey | null = null
const listeners = new Set<(theme: ThemeKey) => void>()

/** 供切换弹层渲染的可选项（顺序：默认黑金在前） */
export const THEME_OPTIONS: ThemePack[] = [themePacks.gold, themePacks.classic]

function normalize(value: unknown): ThemeKey {
  return value === 'gold' || value === 'classic' ? value : DEFAULT_THEME
}

export function getTheme(): ThemeKey {
  if (current) {
    return current
  }
  try {
    current = normalize(Taro.getStorageSync(STORAGE_KEY))
  } catch {
    current = DEFAULT_THEME
  }
  return current
}

/** 页面根容器的主题类名 */
export function themeClassOf(theme: ThemeKey = getTheme()): string {
  return theme === 'gold' ? 'theme-gold' : 'theme-classic'
}

export function themeNameOf(theme: ThemeKey = getTheme()): string {
  return themePacks[theme].name
}

/** 环境适配：H5 同步 html/body，小程序改导航栏与窗口底色 */
function applyEnv(theme: ThemeKey) {
  const pack = themePacks[theme]
  const bg = pack.vars['--mall-bg']

  if (process.env.TARO_ENV === 'h5') {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      root.classList.remove('theme-gold', 'theme-classic')
      root.classList.add(theme === 'gold' ? 'theme-gold' : 'theme-classic')
      root.style.background = bg
      if (document.body) {
        document.body.style.background = bg
      }
    }
    return
  }

  // 小程序：导航栏与窗口底色（失败不阻塞，样式仍有页面根容器兜底）
  void Taro.setNavigationBarColor({
    frontColor: '#ffffff',
    backgroundColor: pack.vars['--mall-nav-bg'],
  }).catch(() => undefined)

  try {
    void (
      Taro as unknown as {
        setBackgroundColor?: (options: {
          backgroundColor: string
          backgroundColorTop: string
          backgroundColorBottom: string
        }) => Promise<unknown>
      }
    ).setBackgroundColor?.({
      backgroundColor: bg,
      backgroundColorTop: bg,
      backgroundColorBottom: bg,
    })
  } catch {
    // 部分端不支持该 API，忽略
  }
}

/** 切换主题：持久化 + 环境适配 + 通知所有已挂载页面 */
export function setTheme(theme: ThemeKey) {
  const next = normalize(theme)
  if (next === getTheme()) {
    return
  }
  current = next
  try {
    Taro.setStorageSync(STORAGE_KEY, next)
  } catch {
    // 存储失败时仅当前会话生效
  }
  applyEnv(next)
  listeners.forEach((listener) => listener(next))
}

export function subscribeTheme(listener: (theme: ThemeKey) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 启动时应用一次（H5 需在首帧前写入 html class，避免闪白） */
export function initTheme() {
  applyEnv(getTheme())
}

/** 页面使用：返回当前主题、根容器类名与切换方法 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeKey>(() => getTheme())

  useEffect(() => subscribeTheme(setThemeState), [])

  return {
    theme,
    themeClass: themeClassOf(theme),
    themeName: themePacks[theme].name,
    options: THEME_OPTIONS,
    setTheme,
  }
}
