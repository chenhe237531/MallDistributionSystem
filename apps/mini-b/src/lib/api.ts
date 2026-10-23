import Taro from '@tarojs/taro'

const BASE = 'http://localhost:3000/api'
const TOKEN_KEY = 'mall_token'

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
    throw new Error(Array.isArray(message) ? message.join('；') : message ?? '请求失败')
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
