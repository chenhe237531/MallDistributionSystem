/**
 * 商家端可配置菜单目录（单一事实源）。
 *
 * 后台「账号与资质」为已入驻商家分配菜单权限时，可选项以本目录为准；
 * 商家端（mini-b）按 key/path 过滤首页宫格、待办与「我的」页入口。
 *
 * 底部 4 个页签（首页 / 采购商城 / 购物车 / 我的）与首页「品牌介绍」锚点
 * 属于平台核心能力，不参与配置；未保存过配置的商家默认拥有全部菜单。
 */
export interface MerchantMenuItem {
  /** 权限 key，持久化到 MerchantMenuPermission.menus */
  key: string
  /** 后台配置界面展示名（与商家端首页宫格文案一致） */
  label: string
  /** 商家端页面路径，用于按 url 归属过滤入口 */
  path: string
  /** 后台配置界面的功能说明 */
  description: string
}

export const MERCHANT_MENU_ITEMS: readonly MerchantMenuItem[] = [
  {
    key: 'procurement',
    label: '采购商城',
    path: '/pages/procurement/index',
    description: '商城商品浏览、购物车与下单',
  },
  {
    key: 'prepaid',
    label: '预付款',
    path: '/pages/prepaid/index',
    description: '预付款余额、充值与流水',
  },
  {
    key: 'customers',
    label: '我的客户',
    path: '/pages/customers/index',
    description: '名下客户与归属关系',
  },
  {
    key: 'journeys',
    label: '健康助手',
    path: '/pages/journeys/index',
    description: '客户肠道健康随访任务',
  },
  {
    key: 'reports',
    label: '报告与解读',
    path: '/pages/reports/index',
    description: '检测报告查看与 AI 解读',
  },
  {
    key: 'business',
    label: '我的生意',
    path: '/pages/business/index',
    description: '业绩、佣金与经营数据',
  },
  {
    key: 'materials',
    label: '素材与培训',
    path: '/pages/materials/index',
    description: '推广素材与话术模板',
  },
  {
    key: 'training',
    label: '课程与考试',
    path: '/pages/training/index',
    description: '课程学习与考试认证',
  },
  {
    key: 'guide',
    label: '业务流程',
    path: '/pages/guide/index',
    description: '采购与检测业务流程指引',
  },
  {
    key: 'claims',
    label: '客户认领',
    path: '/pages/claims/index',
    description: '认领未绑定的客户',
  },
] as const

export const MERCHANT_MENU_KEYS: readonly string[] = MERCHANT_MENU_ITEMS.map((item) => item.key)

/** 未配置商家的默认菜单：全量（保持存量商家行为不变） */
export const DEFAULT_MERCHANT_MENUS: readonly string[] = MERCHANT_MENU_KEYS

/** key → 目录项映射 */
export const MERCHANT_MENU_BY_KEY: ReadonlyMap<string, MerchantMenuItem> = new Map(
  MERCHANT_MENU_ITEMS.map((item) => [item.key, item]),
)

/** path → key 映射（精确匹配页面路径） */
export const MERCHANT_MENU_KEY_BY_PATH: ReadonlyMap<string, string> = new Map(
  MERCHANT_MENU_ITEMS.map((item) => [item.path, item.key]),
)

export type MerchantMenusValidation =
  | { ok: true; menus: string[] }
  | { ok: false; error: string }

/**
 * 校验待保存的菜单 key 列表：
 * - 必须是字符串数组（允许空数组 = 关闭全部可选菜单，仅保留核心页签）
 * - 去重并按目录顺序归一
 * - 出现目录外的 key 时返回中文错误（未知项示例附在消息里）
 */
export function validateMerchantMenus(input: unknown): MerchantMenusValidation {
  if (!Array.isArray(input)) {
    return { ok: false, error: '菜单权限必须是数组' }
  }
  const requested = input.filter((item): item is string => typeof item === 'string')
  if (requested.length !== input.length) {
    return { ok: false, error: '菜单权限项必须是字符串' }
  }
  const unknown = requested.filter((key) => !MERCHANT_MENU_BY_KEY.has(key))
  if (unknown.length > 0) {
    return { ok: false, error: `包含未知菜单项：${unknown.join('、')}` }
  }
  const unique = new Set(requested)
  const menus = MERCHANT_MENU_KEYS.filter((key) => unique.has(key))
  return { ok: true, menus }
}

/**
 * 商家端按页面 url 判断入口是否可见：
 * 目录外路径（核心页签、登录、详情页等）默认可见。
 */
export function isMerchantPathAllowed(menus: readonly string[], path: string): boolean {
  if (path.includes('?')) {
    path = path.slice(0, path.indexOf('?'))
  }
  const key = MERCHANT_MENU_KEY_BY_PATH.get(path)
  if (!key) {
    return true
  }
  return menus.includes(key)
}
