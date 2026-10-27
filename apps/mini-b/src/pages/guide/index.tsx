import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { BIZ_WECHAT_ID, SERVICE_HOTLINE } from '../../config/home'
import { Icon } from '../../components/Icon'
import { PageToast, toast } from '../../components/feedback'
import { useTheme } from '../../lib/theme'

type Flow = {
  key: string
  title: string
  desc: string
  steps: Array<{ label: string; hint?: string }>
}

/**
 * 服务与履约指南（方案 §3.5-5b）。
 * 三条流程均取自 docs/归档资料整理与内容转化方案.md §4.3「业务流程链路」，不新增虚构节点。
 */
const FLOWS: Flow[] = [
  {
    key: 'procurement',
    title: '采购履约流程',
    desc: '从选品到收货的标准链路，采购单状态可在「我的采购单」实时查看。',
    steps: [
      { label: '选购加购', hint: '采购商城按分类浏览，商品详情页可查看规格与合规说明' },
      { label: '提交采购单', hint: '按供应商合并结算，预付款账户自动扣款' },
      { label: '平台 / 供应商发货', hint: '扣款后进入待发货，发货后可在采购单查看运单号' },
      { label: '确认收货', hint: '收货后核对批次、效期与储运条件' },
      { label: '盒码激活（如适用）', hint: '检测类商品激活盒码后进入样本流程' },
    ],
  },
  {
    key: 'sample',
    title: '样本检测流程',
    desc: '面向商家服务客户的检测链路，帮助统一对外口径。',
    steps: [
      { label: '盒码激活', hint: '客户扫码绑定样本，填写基础信息' },
      { label: '居家采样', hint: '按采样视频与说明书操作，避免污染样本' },
      { label: '样本寄回', hint: '使用指定包装与快递上门取件' },
      {
        label: '实验室检测',
        hint: '收样后标准版 7-10 个工作日、极速版 3-5 个工作日出报告',
      },
      { label: '报告出具', hint: '报告仅用于健康风险提示，不作为临床诊断依据' },
      { label: '专业解读', hint: '可通过平台申请报告解读，异常指标按建议复检或就医' },
    ],
  },
  {
    key: 'service',
    title: '售后与咨询流程',
    desc: '检测、移植、报告、物流四类问题按统一路径处理。',
    steps: [
      { label: '联系商务 / 客服', hint: `服务热线 ${SERVICE_HOTLINE}` },
      { label: '问题分类', hint: '检测 / 移植 / 报告 / 物流' },
      { label: '自助查询', hint: '课程与考试、报告与解读、我的采购单可自助查询' },
      { label: '专人跟进', hint: '复杂问题由渠道经理对接企业医学与运营团队' },
    ],
  },
]

export default function Guide() {
  const { themeClass } = useTheme()
  const copyWechat = () => {
    void Taro.setClipboardData({
      data: BIZ_WECHAT_ID,
      success: () => toast('微信号已复制', 'success'),
    })
  }

  return (
    <View className={`page ${themeClass}`}>
      <PageToast />

      <View className="guide-head">
        <Text className="guide-head-title">服务与履约指南</Text>
        <Text className="guide-head-sub">采购 · 检测 · 售后三条主流程，一页看懂</Text>
      </View>

      {FLOWS.map((flow) => (
        <View key={flow.key} className="card guide-card">
          <Text className="guide-title">{flow.title}</Text>
          <Text className="guide-desc">{flow.desc}</Text>
          <View className="guide-steps">
            {flow.steps.map((step, index) => (
              <View key={step.label} className="guide-step">
                <View className="guide-step-index">{index + 1}</View>
                {index < flow.steps.length - 1 ? <View className="guide-step-line" /> : null}
                <View className="guide-step-main">
                  <Text className="guide-step-label">{step.label}</Text>
                  {step.hint ? <Text className="guide-step-hint">{step.hint}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}

      <View className="contact-card">
        <View className="contact-icon">
          <Icon name="headset" size={20} />
        </View>
        <View className="contact-main">
          <Text className="contact-title">专属渠道经理</Text>
          <Text className="contact-desc">服务热线 {SERVICE_HOTLINE} · 微信 {BIZ_WECHAT_ID}</Text>
        </View>
        <View className="contact-btn" onClick={copyWechat}>
          复制微信号
        </View>
      </View>

      <Text className="guide-compliance">
        以上流程为服务说明，具体以合同、产品说明书及医疗机构诊疗规范为准；移植类产品须在执业医师指导下使用。
      </Text>
    </View>
  )
}
