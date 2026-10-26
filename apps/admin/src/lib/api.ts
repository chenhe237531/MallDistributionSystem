import type { Role } from '@mall/shared'

const TOKEN_KEY = 'mall_admin_token'
const USER_KEY = 'mall_admin_user'

export type SessionUser = {
  id: string
  name: string
  phone: string
  role: Role
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getSessionUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export function setSessionUser(user: SessionUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSessionUser(): void {
  localStorage.removeItem(USER_KEY)
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(options.headers)
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`/api${path}`, { ...options, headers })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message.join('；') : body?.message
    throw new Error(message ?? `请求失败（${response.status}）`)
  }
  return body as T
}
