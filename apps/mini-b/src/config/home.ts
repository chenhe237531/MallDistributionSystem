import type { IconName } from '../components/Icon'
import { PRODUCT_CATEGORIES } from '@mall/shared'

/**
 * 百英诺商家端改版前端常量（§4 品牌内容 / §6.2 分类 / 决策点 D3、D4 初版常量）。
 * 品牌事实性内容取自 docs/归档/ 企业资料，不得虚构；占位项（D7）标注「占位」。
 * 后续迭代：banner/公告/客服号迁 admin 配置（P2）、商品分类落库（P1）。
 */

/** 服务热线（占位，待企业提供后替换） */
export const SERVICE_HOTLINE = '4009-603-608'

/** 商务联系微信号（占位，待企业确认后替换） */
export const BIZ_WECHAT_ID = 'baiyingnuo-biz'

/** 首页公告（后续接公告接口） */
export const NOTICE_TEXT =
  '百英诺商家平台 2026 全新上线｜同济医院首家成果转化企业｜检测—解读—移植—随访全周期服务'

/** Banner 轮播（§4.1，3 张） */
export const BANNERS: Array<{ title: string; subtitle: string }> = [
  {
    title: '同济医院首家成果转化标杆企业',
    subtitle: '百英诺 · 菌群移植全周期服务平台',
  },
  {
    title: 'GMP 车间 · P2 实验室 · 华中菌群库',
    subtitle: '供体 500+｜入库菌群样本 3000+',
  },
  {
    title: '检测 — 解读 — 移植 — 随访',
    subtitle: '全周期定制化精准微生态管理',
  },
]

/** 走进百英诺 · 品牌故事（§4.2-1，逐字） */
export const BRAND_STORY =
  '武汉百英诺生物科技有限公司成立于 2021 年，是华中科技大学同济医学院附属同济医院首家孵化的成果转化标杆企业。创始人王桂华教授（国家杰青、同济医院胃肠外科主任）领衔，团队含院士 1 名、国家级高层次人才 5 名。'

/** 走进百英诺 · 实力数字条（§4.2-2，逐字拆分） */
export const BRAND_STATS: Array<{ value: string; label: string; note?: string }> = [
  { value: '100+', label: '发明专利' },
  { value: '50+', label: '国家级课题', note: '总经费超 2 亿元' },
  { value: '6 篇', label: 'Nature/Cell/Science 主刊论文' },
  { value: '2000+ 例', label: '同济院内临床' },
]

/** 走进百英诺 · 产品线导览（§4.2-3，点击跳采购页对应分类） */
export const PRODUCT_LINES: Array<{
  title: string
  desc: string
  category: string
}> = [
  {
    title: '检测服务',
    desc: '肠道菌群基因组检测（标准版 / 极速版），3 万+ 种微生物全景扫描',
    category: 'gut_test',
  },
  {
    title: '移植产品',
    desc: 'FMT 健康人源肠道菌群胶囊 / 升级版 / 菌泥 / 专用辅剂',
    category: 'fmt',
  },
  {
    title: '健康消费品',
    desc: '英诺衡 · 英诺畅 · 英诺纤（特殊膳食，SC 认证）',
    category: 'consumer_health',
  },
  {
    title: '定制化产品',
    desc: '定制化活菌胶囊 · 益生菌元液（一人一菌方）',
    category: 'customized',
  },
]

/** 资质认证条（§4.2-4：证书图源待企业导出授权后入库，先文字占位） */
export const BRAND_CERTS = ['GMP', 'P2 实验室', 'ISO9001 三体系', 'SC 认证']

/** 合规声明（§4.2 底部固定，§12 红线） */
export const COMPLIANCE_NOTE =
  '本页面内容仅供健康信息参考，不构成诊疗建议；移植类产品须在执业医师指导下使用。'

/** ===== 采购商城分类（方案 §3.3：一级分类以 Product.category 落库字段为准） ===== */
export type MallCategory = {
  key: string
  label: string
  /** 二级分类 pill（仅二级筛选仍按名称关键词，一级分类不猜） */
  subs: Array<{ key: string; label: string; keywords: string[] }>
}

export const MALL_CATEGORIES: MallCategory[] = [
  { key: 'all', label: '全部商品', subs: [] },
  ...PRODUCT_CATEGORIES.map((category) => ({
    key: category.key,
    label: category.label,
    subs: category.subs,
  })),
]

/** 资质标签（方案 §3.2：按商品分类映射，替代按商品名关键词猜测） */
export const GOODS_TAGS_BY_CATEGORY: Record<string, string[]> = {
  gut_test: ['3 万+ 微生物全景'],
  fmt: ['GMP', '同济共建菌库'],
  adjunct: ['院线级'],
  consumer_health: ['SC 认证', '特殊膳食'],
  customized: ['一人一菌方'],
  training_kit: ['居家采样'],
}

export function goodsTags(category?: string | null): string[] {
  return category ? GOODS_TAGS_BY_CATEGORY[category] ?? [] : []
}

/** 采购单状态桶（「我的」页 5 图标行过滤用，与 prisma ProcurementOrder 状态枚举对齐） */
export const PROFILE_ORDER_BUCKETS: Array<{
  key: string
  label: string
  icon: 'wallet' | 'box' | 'packageCheck' | 'checkCircle' | 'headset'
  statuses: string[]
}> = [
  { key: 'pending_shipment', label: '待发货', icon: 'box', statuses: ['deducted', 'pending_shipment'] },
  { key: 'shipped', label: '待收货', icon: 'packageCheck', statuses: ['shipped'] },
  { key: 'received', label: '已收货', icon: 'checkCircle', statuses: ['received'] },
  { key: 'completed', label: '已完成', icon: 'wallet', statuses: ['completed'] },
  { key: 'after_sale', label: '售后', icon: 'headset', statuses: ['after_sale', 'refunded'] },
]

/** ===== 首页功能宫格 10 入口（§6.1） ===== */
export type HomeEntry = {
  label: string
  icon: IconName
  tone: 'primary' | 'success' | 'warning' | 'danger'
  /** url 为空表示锚点滚动到品牌介绍区 */
  url: string
}

export const HOME_ENTRIES: HomeEntry[] = [
  { label: '采购商城', icon: 'shop', tone: 'primary', url: '/pages/procurement/index' },
  { label: '预付款', icon: 'wallet', tone: 'warning', url: '/pages/prepaid/index' },
  { label: '我的客户', icon: 'users', tone: 'success', url: '/pages/customers/index' },
  { label: '报告与解读', icon: 'report', tone: 'primary', url: '/pages/reports/index' },
  { label: '我的生意', icon: 'chart', tone: 'success', url: '/pages/business/index' },
  { label: '素材与培训', icon: 'palette', tone: 'warning', url: '/pages/materials/index' },
  { label: '课程与考试', icon: 'book', tone: 'primary', url: '/pages/training/index' },
  { label: '业务流程', icon: 'packageCheck', tone: 'success', url: '/pages/guide/index' },
  { label: '客户认领', icon: 'userPlus', tone: 'primary', url: '/pages/claims/index' },
  { label: '品牌介绍', icon: 'star', tone: 'warning', url: '' },
]
