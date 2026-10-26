import type { IconName } from '../components/Icon'

/** 品牌信息（来源：docs/归档 企业资料，不虚构数据） */
export const BRAND = {
  name: '百英诺科技',
  nameEn: 'BIO-INNO',
  title: '菌群检测',
  slogan: '专注创新成果转化',
}

/** 首页使用说明轮播（2 张前端常量，§4.1） */
export const HOME_BANNERS: Array<{
  title: string
  subtitle: string
  cta: string
  url: string
}> = [
  {
    title: '使用说明',
    subtitle: '快速上手指南，采样步骤详解',
    cta: '查看详情',
    url: '/pages/tech-intro/index?anchor=sampling',
  },
  {
    title: '检测流程',
    subtitle: '绑定 → 问卷 → 寄回 → 收报告',
    cta: '查看进度',
    url: '/pages/progress/index',
  },
]

export type HomeEntry = {
  key: string
  label: string
  icon: IconName
  url?: string
  action?: 'service'
  /** 需要登录才能进入 */
  auth?: boolean
}

/** 首页服务四宫格（§4.1） */
export const HOME_ENTRIES: HomeEntry[] = [
  { key: 'bind', label: '绑定样本', icon: 'box', url: '/pages/activate/index', auth: true },
  { key: 'progress', label: '检测进度', icon: 'packageCheck', url: '/pages/progress/index', auth: true },
  { key: 'tech', label: '技术介绍', icon: 'book', url: '/pages/tech-intro/index' },
  { key: 'service', label: '联系客服', icon: 'headset', action: 'service' },
]

/** 技术介绍章节（§4.5，内容取自 docs/归档 内部资料，不虚构数据） */
export type TechSection = {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  steps?: string[]
  /** 配图未取得前显示占位说明 */
  imagePlaceholder?: boolean
}

export const TECH_SECTIONS: TechSection[] = [
  {
    id: 'second-genome',
    title: '解密人类「第二基因组」',
    imagePlaceholder: true,
    paragraphs: [
      '人体肠道内栖息着约 100 万亿微生物，它们参与人体 99% 的营养吸收与 70% 的免疫调节，常被称为人类的「第二基因组」。',
      '肠道菌群的组成与多样性，与消化、代谢、免疫等健康状态密切相关。',
    ],
  },
  {
    id: 'gut-health',
    title: '人体肠道微生态与健康',
    imagePlaceholder: true,
    paragraphs: ['肠道菌群通过多条「肠-器官轴」与全身健康相互影响：'],
    bullets: ['肠-脑轴', '肠-皮肤轴', '肠-肝轴', '肠-甲状腺轴'],
  },
  {
    id: 'fmt',
    title: '菌群移植（FMT）与五大调控机制',
    paragraphs: ['菌群移植（FMT）通过重建肠道微生态发挥作用，常见调控机制包括：'],
    bullets: ['竞争性生态位占领', '免疫稳态调节', '肠黏膜屏障修复', '代谢网络调控', '氧环境调控'],
  },
  {
    id: 'factors',
    title: '影响肠道微生态的常见因素',
    paragraphs: ['饮食与生活习惯、药物使用等都会影响肠道菌群平衡：'],
    bullets: ['中药', '抗生素', '酒精', '膳食', '作息'],
  },
  {
    id: 'testing',
    title: '高通量宏基因组检测',
    paragraphs: [
      '采用高通量宏基因组测序，可检出细菌、真菌、病毒等 3 万多种微生物，精准度高于 16S rRNA 检测。',
      '检测报告围绕微生态指数、健康评估、代谢评估与疾病风险预测等模块展开，并配套专业报告解读服务。',
    ],
    bullets: [
      '标准版：收样后 7–10 个工作日出具报告',
      '极速版：收样后 3–5 个工作日出具报告',
    ],
  },
  {
    id: 'sampling',
    title: '采样指引',
    imagePlaceholder: true,
    steps: [
      '使用盒内无菌采样勺，取粪便内部 1–3 颗黄豆大小（约 3–5g）。',
      '避免混入尿液、水或血液；生理期不建议取样。',
      '将样本放入专用采样管并拧紧管盖，按盒内说明填写样本标签。',
      '采样管含专用保存液，可保护微生物基因组 DNA，室温可保存 7 天。',
      '采样后尽快使用盒内附带的寄回包装寄回实验室。',
    ],
  },
]

/** 寄回指引（进度页 pending_mail / activated 状态） */
export const MAILING_GUIDE = [
  '使用盒内附带的寄回包装与快递面单，通过京东快递上门取件寄回实验室。',
  '寄出后在本页登记运单号，便于我们跟进样本运输状态。',
  '寄回地址与收件信息以盒内面单为准；如有疑问请联系客服。',
]

/** 客服信息占位（D7：号码 / 微信 / 工作时间待企业提供，不编造） */
export const SERVICE_INFO = [
  { label: '客服电话', value: '待企业提供' },
  { label: '客服微信', value: '待企业提供' },
  { label: '服务时间', value: '待企业提供' },
]

/** 知情同意书正文占位（D8：待企业法务稿） */
export const CONSENT_PLACEHOLDER =
  '知情同意书正文待企业法务提供后更新，本页仅作为签署入口占位，不展示未确认的条款内容。'

/** 免责声明（§6 合规红线） */
export const TECH_DISCLAIMER = '本内容仅作健康科普，不构成医疗诊断建议。'
export const REPORT_DISCLAIMER = '本报告仅用于健康风险提示，不作为临床诊断依据。'
