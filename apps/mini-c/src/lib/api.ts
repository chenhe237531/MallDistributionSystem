import Taro from '@tarojs/taro'
import { handleAuthExpired } from '../components/feedback'

const BASE = 'http://localhost:3000/api'
/** 静态资源源站：商品图存相对路径 /uploads/...，展示前补全域名 */
const ORIGIN = BASE.replace(/\/api$/, '')
const TOKEN_KEY = 'mall_c_token'

/** 将后端相对资源路径补全为可访问 URL；绝对地址原样返回 */
export function resolveAsset(url?: string | null): string {
  if (!url) {
    return ''
  }
  if (/^https?:\/\//.test(url)) {
    return url
  }
  return `${ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`
}

export function getToken(): string {
  return Taro.getStorageSync(TOKEN_KEY) ?? ''
}

export function setToken(token: string): void {
  Taro.setStorageSync(TOKEN_KEY, token)
}

export function clearToken(): void {
  Taro.removeStorageSync(TOKEN_KEY)
}

export function go(url: string): void {
  void Taro.navigateTo({ url })
}

export function routeParams(): Record<string, string> {
  const params = Taro.getCurrentInstance().router?.params ?? {}
  return params as Record<string, string>
}

export async function api<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH'; data?: unknown } = {},
): Promise<T> {
  const token = getToken()
  const response = await Taro.request({
    url: `${BASE}${path}`,
    method: options.method ?? 'GET',
    data: options.data,
    header: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (response.statusCode >= 400) {
    const message = response.data?.message
    const text = Array.isArray(message) ? message.join('；') : message ?? '请求失败'
    // FR-X：登录失效 / 账号不存在时统一提示并跳登录页，不留白屏
    if (response.statusCode === 401 || response.statusCode === 404) {
      handleAuthExpired(text)
    }
    throw new Error(text)
  }
  return response.data as T
}

export function ensureLogin(): boolean {
  if (!getToken()) {
    void Taro.redirectTo({ url: '/pages/login/index' })
    return false
  }
  return true
}
