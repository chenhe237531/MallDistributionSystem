import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Toast } from '@nutui/nutui-react-taro'
import { clearToken, getToken } from '../lib/api'

/**
 * FR-X 统一反馈封装：
 * - 页面无需手动挂载 <Toast id>；未挂载时自动降级到 Taro.showToast，杜绝反馈静默丢失
 * - api 层捕获登录失效时统一提示并跳转登录页
 */

const APP_TOAST_ID = 'app-toast'

let toastMounted = false

/** 页面挂载 <PageToast /> 后由组件内部调用 */
export function setPageToastMounted(mounted: boolean): void {
  toastMounted = mounted
}

/** 每个使用 toast() 的页面放置一次即可（不放置也能工作，走降级通道） */
export function PageToast() {
  useEffect(() => {
    setPageToastMounted(true)
    return () => setPageToastMounted(false)
  }, [])
  return <Toast id={APP_TOAST_ID} />
}

/** 统一轻提示：icon 可选 'success' | 'fail'；默认纯文本 */
export function toast(title: string, icon: 'success' | 'fail' | 'none' = 'none'): void {
  if (toastMounted) {
    Toast.show(APP_TOAST_ID, {
      title,
      icon: icon === 'none' ? undefined : icon,
      duration: 2000,
    })
  } else {
    void Taro.showToast({
      title,
      icon: icon === 'success' ? 'success' : icon === 'fail' ? 'error' : 'none',
      duration: 2000,
    })
  }
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
