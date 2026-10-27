/**
 * 健康问卷内置题单（来源：《样本信息问卷调查表》，重排为 Q1–Q22）。
 * 商品配置了 questionnaireFields 时优先使用商品配置（§5.5）。
 */

export type QuestionType = 'text' | 'number' | 'radio' | 'checkbox' | 'textarea'

export type Question = {
  key: string
  label: string
  type: QuestionType
  required?: boolean
  options?: string[]
  /** checkbox 互斥项：选中后清空其他选项 */
  exclusiveOptions?: string[]
  /** 选中这些选项时展开备注输入 */
  remarkOn?: string[]
  unit?: string
  placeholder?: string
  /** 绑定时自动带入，只读 */
  readonly?: boolean
}

/** 文档开头 3 条填写须知（原样展示） */
export const QUESTIONNAIRE_INTRO = [
  '依据您填写的这份健康信息表，我们将对您目前的健康状况进行一次全面、系统地评估；',
  '本表填写的内容关系到检测报告的准确性，请您务必完整、客观地填写；',
  '健康信息涉及您的个人隐私，我们将对您所有的个人资料严格保密。',
]

/** 疾病多选（原文：32 项 + 其他） */
const DISEASES = [
  '肥胖',
  '腹泻',
  '便秘',
  '哮喘',
  '粉刺痤疮',
  '皮肌炎',
  '炎症性肠病(IBD)',
  '肠易激综合征(IBS)',
  '溃疡性结肠炎(UC)',
  '麸质敏感性肠病',
  '克罗恩病(CD)',
  '大肠癌(结肠癌、直肠癌)',
  '慢性疲劳综合征',
  '痛风(原发性、继发性)',
  '类风湿性关节炎',
  '系统性红斑狼疮',
  '甲状腺机能亢进',
  '多发性硬化症',
  'Ⅰ型糖尿病',
  'Ⅱ型糖尿病',
  '心肌炎',
  '冠心病',
  '高血压性心脏病',
  '中风(脑卒中、卒中)',
  '帕金森病',
  '抑郁症',
  '焦虑症',
  '自闭症(儿童孤独症)',
  '阿尔茨海默症(老年痴呆)',
  '精神分裂症',
  '糙皮症',
  '癫痫',
]

export const DEFAULT_QUESTIONS: Question[] = [
  { key: 'name', label: '姓名', type: 'text', required: true, placeholder: '请输入姓名' },
  {
    key: 'sampleNo',
    label: '样本编号',
    type: 'text',
    required: true,
    readonly: true,
    placeholder: '绑定后自动带入',
  },
  {
    key: 'phone',
    label: '联系方式（手机号码）',
    type: 'text',
    required: true,
    placeholder: '请输入手机号码',
  },
  { key: 'region', label: '居住地区', type: 'text', required: true, placeholder: '请输入居住地区' },
  { key: 'age', label: '年龄', type: 'number', required: true, placeholder: '请输入年龄' },
  {
    key: 'gender',
    label: '性别',
    type: 'radio',
    required: true,
    options: ['男', '女'],
  },
  { key: 'heightCm', label: '身高', type: 'number', unit: '厘米', placeholder: '请输入身高' },
  { key: 'weightKg', label: '体重', type: 'number', unit: '公斤', placeholder: '请输入体重' },
  {
    key: 'stress',
    label: '是否有精神压力/焦虑',
    type: 'radio',
    required: true,
    options: ['经常', '偶尔', '从不'],
  },
  {
    // 原文选项疑为睡眠时长错配，按原文保留，待企业确认（D6）
    key: 'exercise',
    label: '是否经常锻炼身体',
    type: 'radio',
    required: true,
    options: ['5-6 小时', '6-7 小时', '7-8 小时', '8 小时以上'],
  },
  {
    key: 'stayUp',
    label: '是否经常熬夜',
    type: 'radio',
    required: true,
    options: ['经常', '偶尔', '从不'],
  },
  {
    key: 'smoking',
    label: '是否经常抽烟',
    type: 'radio',
    required: true,
    options: ['经常', '偶尔', '从不'],
  },
  {
    key: 'dietPreference',
    label: '饮食偏好',
    type: 'checkbox',
    required: true,
    options: ['偏荤', '偏素', '偏辣', '偏甜', '其他'],
    remarkOn: ['其他'],
  },
  {
    key: 'dietRegularity',
    label: '饮食是否规律',
    type: 'radio',
    required: true,
    options: ['非常规律', '比较规律', '不规律'],
  },
  {
    key: 'allergy',
    label: '食物/药物过敏情况',
    type: 'radio',
    required: true,
    options: ['有', '无', '不确定'],
    remarkOn: ['有', '不确定'],
  },
  {
    key: 'gutIssues',
    label: '近一月肠道健康问题（可多选）',
    type: 'checkbox',
    required: true,
    options: [
      '消化不良打嗝',
      '腹胀胀气爱放屁',
      '腹痛',
      '排便不规律',
      '大便不成形',
      '排便困难',
      '食欲不振',
      '腹泻便秘交替',
      '以上均无',
    ],
    exclusiveOptions: ['以上均无'],
  },
  {
    key: 'stoolShape',
    label: '近一月大便形状',
    type: 'radio',
    required: true,
    options: ['香蕉状成型软便', '糊状软便', '粘液血便', '稀水样便', '羊屎蛋样粪便'],
  },
  {
    key: 'bowelFrequency',
    label: '近一月排便频率',
    type: 'radio',
    required: true,
    options: ['每天1-2次', '每周2次', '每周1次', '每周少于1次', '每月少于1次'],
  },
  {
    key: 'antibiotics',
    label: '近期是否使用抗生素',
    type: 'radio',
    required: true,
    options: ['一周内', '半个月内', '一个月内', '三个月内', '无'],
  },
  {
    key: 'supplements',
    label: '目前有无服用药品/营养补充剂/益生菌产品',
    type: 'radio',
    required: true,
    options: ['有', '无', '其他'],
    remarkOn: ['有', '其他'],
  },
  {
    key: 'diagnosedDiseases',
    label: '基于医生诊断，是否有以下疾病（可多选）',
    type: 'checkbox',
    required: true,
    options: [...DISEASES, '其他'],
    remarkOn: ['其他'],
  },
  {
    key: 'surgeryHistory',
    label: '是否有手术史及遗传病史',
    type: 'textarea',
    required: true,
    placeholder: '有请详填，无填「无」',
  },
]

/** 商品问卷字段 → 内置题型（向后兼容：无 type 视为 text） */
export function fromProductFields(
  fields: Array<{
    key: string
    label?: string
    type?: QuestionType
    required?: boolean
    options?: string[]
    exclusiveOptions?: string[]
    remarkOn?: string[]
    unit?: string
    placeholder?: string
  }>,
): Question[] {
  return fields.map((field) => ({
    key: field.key,
    label: field.label ?? field.key,
    type: field.type ?? 'text',
    required: field.required,
    options: field.options,
    exclusiveOptions: field.exclusiveOptions,
    remarkOn: field.remarkOn,
    unit: field.unit,
    placeholder: field.placeholder,
  }))
}
