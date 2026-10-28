import { isMerchantPathAllowed } from '@mall/shared'
import { api } from './api'

/**
 * 商家端菜单权限：登录用户拉取生效菜单（商家主账号本人配置 / 销售继承组织配置）。
 * 拉取失败或接口不可达时返回 null，页面按「不过滤」兜底（fail-open），不阻断主流程。
 */

const CACHE_TTL_MS = 60_000

let cache: { menus: string[]; expiresAt: number } | null = null

export async function loadMerchantMenus(): Promise<string[] | null> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.menus
  }
  try {
    const result = await api<{ menus: string[] }>('/merchant-menus/me')
    cache = { menus: result.menus, expiresAt: Date.now() + CACHE_TTL_MS }
    return result.menus
  } catch {
    return null
  }
}

/** 切换账号（登录 / 退出）时清掉旧用户的菜单缓存 */
export function clearMerchantMenusCache(): void {
  cache = null
}

/**
 * 按 url 过滤带跳转的入口列表：
 * - menus 为 null（未拉到配置）时不过滤
 * - url 为空的锚点类入口（如「品牌介绍」）保留
 * - 目录外路径（消息中心、定价、登录等）保留
 */
export function filterEntriesByMenus<T extends { url: string }>(
  menus: string[] | null,
  entries: readonly T[],
): T[] {
  if (!menus) {
    return [...entries]
  }
  return entries.filter((entry) => !entry.url || isMerchantPathAllowed(menus, entry.url))
}
