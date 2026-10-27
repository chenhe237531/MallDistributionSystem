import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { clearToken, getToken } from '../lib/api'

/**
 * FR-X 统一反馈封装：
 * - 页面挂载 <PageToast /> 后由自研轻量 toast 呈现（点击提示区域可立即关闭）；
 *   未挂载时自动降级到 Taro.showToast，杜绝反馈静默丢失
 * - 不再使用 NutUI Toast：其 duration 单位为「秒」且 Toast.show 的受控 visible
 *   模式下 closeOnOverlayClick 关闭路径失效（点击永远关不掉）
 * - api 层捕获登录失效时统一提示并跳转登录页
 */

type ToastIcon = 'success' | 'fail' | 'none'

type ToastState = { open: boolean; title: string; icon: ToastIcon }

const CLOSED: ToastState = { open: false, title: '', icon: 'none' }
const TOAST_DURATION_MS = 2000

/** 页面栈可能有多个 PageToast（订单页 → 地址簿页）：只有栈顶实例负责渲染，卸载时移交并同步当前状态 */
let renderers: Array<(state: ToastState) => void> = []
let current: ToastState = CLOSED
let hideTimer: ReturnType<typeof setTimeout> | null = null

function emit(state: ToastState): void {
  current = state
  renderers[renderers.length - 1]?.(state)
}

/** 统一轻提示：icon 可选 'success' | 'fail'；默认纯文本 */
export function toast(title: string, icon: ToastIcon = 'none'): void {
  if (renderers.length > 0) {
    if (hideTimer) {
      clearTimeout(hideTimer)
    }
    emit({ open: true, title, icon })
    hideTimer = setTimeout(() => {
      hideTimer = null
      emit(CLOSED)
    }, TOAST_DURATION_MS)
  } else {
    void Taro.showToast({
      title,
      icon: icon === 'success' ? 'success' : icon === 'fail' ? 'error' : 'none',
      duration: TOAST_DURATION_MS,
    })
  }
}

/** 点击提示区域立即关闭 */
function closeToast(): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  emit(CLOSED)
}

/** 每个使用 toast() 的页面放置一次即可（不放置也能工作，走降级通道） */
export function PageToast() {
  const [state, setState] = useState<ToastState>(CLOSED)

  useEffect(() => {
    renderers.push(setState)
    setState(current)
    return () => {
      renderers = renderers.filter((renderer) => renderer !== setState)
      // 移交渲染权给下一层页面，并同步状态避免残留旧 toast
      renderers[renderers.length - 1]?.(current)
    }
  }, [])

  if (!state.open) {
    return null
  }

  return (
    <View className="app-toast-mask" onClick={() => closeToast()}>
      <View className={`app-toast ${state.icon === 'none' ? '' : `app-toast-${state.icon}`}`}>
        {state.icon !== 'none' ? (
          <Text className="app-toast-icon">{state.icon === 'success' ? '✓' : '✕'}</Text>
        ) : null}
        <Text className="app-toast-title">{state.title}</Text>
      </View>
    </View>
  )
}

/**
 * 登录失效 / 账号不存在（如 seed 重跑后旧 token）：清 token、提示并跳登录页
 * 401 一律按状态码判定（后端文案「登录已过期」「缺少登录凭证」等会随版本变化，避免漏匹配）
 */
export function handleAuthExpired(message: string, status?: number): boolean {
  if (!getToken()) {
    return false
  }
  if (status === 401 || /账号不存在|登录状态|登录已失效|未登录|token/i.test(message)) {
    clearToken()
    toast('登录已失效，请重新登录', 'fail')
    void Taro.redirectTo({ url: '/pages/login/index' })
    return true
  }
  return false
}
