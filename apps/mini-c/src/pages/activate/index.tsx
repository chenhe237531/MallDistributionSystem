import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, Video, View } from '@tarojs/components'
import {
  Button as NutButton,
  Input as NutInput,
  Switch as NutSwitch,
  Toast,
} from '@nutui/nutui-react-taro'
import { api, ensureLogin, go, routeParams } from '../../lib/api'

type QuestionnaireField = {
  key: string
  label?: string
  required?: boolean
  placeholder?: string
}

type BoxPreview = {
  boxCode: string
  status: string
  activatedAt: string | null
  productName: string
  product: {
    name: string
    skuCode: string
    sampleType: string
    guideVideoUrl: string | null
    intro: string | null
    questionnaireFields: Array<{ key: string; label?: string; required?: boolean }> | null
  }
}

type ActivationResult = {
  sample: { id: string; sampleNo: string; status: string }
  ownership: { channelType: string; sourceBoxCode: string }
  consent: { reportAuthorization: boolean; templateVersion: number }
}

/** 兜底问卷字段：盒码未查询或商品未配置问卷字段时使用 */
const FALLBACK_FIELDS: QuestionnaireField[] = [
  { key: 'gender', label: '性别', placeholder: '性别 male / female' },
  { key: 'age', label: '年龄', required: true, placeholder: '年龄' },
]

const STATUS_LABELS: Record<string, string> = {
  generated: '待激活',
  active: '已激活',
  used: '已使用',
  voided: '已作废',
}

export default function Activate() {
  const params = routeParams()
  const [boxCode, setBoxCode] = useState(params.code ?? '')
  const [orderId, setOrderId] = useState(params.orderId ?? '')
  const [questionnaire, setQuestionnaire] = useState<Record<string, string>>({
    gender: 'male',
    age: '',
  })
  const [preview, setPreview] = useState<BoxPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const [reportAuthorization, setReportAuthorization] = useState(true)
  const [result, setResult] = useState<ActivationResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 动态问卷字段：preview 成功且商品配置了字段则动态渲染，否则用性别/年龄兜底
  const fields: QuestionnaireField[] =
    preview?.product.questionnaireFields && preview.product.questionnaireFields.length > 0
      ? preview.product.questionnaireFields
      : FALLBACK_FIELDS
  const boxUnavailable = preview !== null && preview.status !== 'generated'

  const setField = (key: string, value: string) => {
    setQuestionnaire((prev) => ({ ...prev, [key]: value }))
  }

  const queryPreview = async () => {
    const code = boxCode.trim().toUpperCase()
    if (!code) {
      setError('请先输入盒码')
      return
    }
    setPreviewing(true)
    setError('')
    try {
      const data = await api<BoxPreview>(`/box-codes/preview/${encodeURIComponent(code)}`)
      setPreview(data)
      if (data.product.questionnaireFields && data.product.questionnaireFields.length > 0) {
        setQuestionnaire(
          Object.fromEntries(data.product.questionnaireFields.map((field) => [field.key, ''])),
        )
      }
    } catch (cause) {
      setPreview(null)
      setError(cause instanceof Error ? cause.message : '盒码查询失败')
    } finally {
      setPreviewing(false)
    }
  }

  const submit = async () => {
    if (!ensureLogin()) {
      return
    }
    if (!consentGiven) {
      setError('请先阅读并同意检测服务协议与知情同意书')
      return
    }
    const missing = fields.find((field) => field.required && !(questionnaire[field.key] ?? '').trim())
    if (missing) {
      setError(`请填写${missing.label ?? missing.key}`)
      return
    }
    // 数值类字段尝试转数字，转换失败保持字符串
    const questionnairePayload: Record<string, unknown> = {}
    for (const field of fields) {
      const raw = (questionnaire[field.key] ?? '').trim()
      if (!raw) continue
      const num = Number(raw)
      questionnairePayload[field.key] = Number.isNaN(num) ? raw : num
    }
    setLoading(true)
    setError('')
    try {
      const activated = await api<ActivationResult>('/box-codes/activate', {
        method: 'POST',
        data: {
          boxCode: boxCode.trim().toUpperCase(),
          orderId: orderId.trim() || undefined,
          questionnaire: questionnairePayload,
          consentGiven,
          reportAuthorization,
          samplingMethod: 'self_mail',
          device: 'mini-c-h5',
        },
      })
      setResult(activated)
      Toast.show('activate-toast', { title: '激活成功', icon: 'success' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '激活失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      <Toast id="activate-toast" />
      <View className="card">
        <Text className="section-title">扫码激活检测盒</Text>
        <Text className="muted">
          一盒一码，激活后建立样本与客户归属。激活前请完成实名认证。
        </Text>
        <View className="field-gap" />
        <NutInput
          value={boxCode}
          placeholder="盒码（BX 开头）"
          clearable
          onBlur={(value) => setBoxCode(value)}
        />
        <View className="field-gap" />
        <NutButton
          size="small"
          type="primary"
          fill="outline"
          loading={previewing}
          onClick={() => void queryPreview()}
        >
          查询盒码
        </NutButton>
        {preview ? (
          <View className="preview-box">
            <Text>商品：{preview.productName || preview.product.name}</Text>
            <Text>SKU：{preview.product.skuCode}</Text>
            <Text>
              盒码状态：{STATUS_LABELS[preview.status] ?? preview.status}
              {preview.activatedAt
                ? ` · ${new Date(preview.activatedAt).toLocaleString('zh-CN')}`
                : ''}
            </Text>
            {boxUnavailable ? (
              <Text className="error">该盒已激活或已作废</Text>
            ) : null}
          </View>
        ) : null}
        {preview?.product.guideVideoUrl ? (
          <View className="guide-video-block">
            <Text className="guide-video-title">采样指导视频（建议观看后再取样）</Text>
            <Video
              src={preview.product.guideVideoUrl}
              controls
              showCenterPlayBtn
              objectFit="contain"
            />
            {preview.product.intro ? (
              <Text className="guide-video-intro">{preview.product.intro}</Text>
            ) : null}
          </View>
        ) : null}
        <View className="field-gap" />
        <NutInput
          value={orderId}
          placeholder="关联订单 ID（可选，用于绑定成交）"
          clearable
          onBlur={(value) => setOrderId(value)}
        />
        <Text className="form-label">采样人信息</Text>
        {fields.map((field) => (
          <View key={field.key}>
            <Text className="form-label">
              {field.required ? <Text className="required-star">*</Text> : null}
              {field.label ?? field.key}
            </Text>
            <NutInput
              value={questionnaire[field.key] ?? ''}
              placeholder={field.placeholder ?? `请输入${field.label ?? field.key}`}
              clearable
              onBlur={(value) => setField(field.key, value)}
            />
          </View>
        ))}
        <View className="field-gap" />
        <View className="row">
          <Text>报告授权给商家/渠道查看</Text>
          <NutSwitch
            checked={reportAuthorization}
            onChange={(value) => setReportAuthorization(value)}
          />
        </View>
        <View className="row">
          <Text>已阅读并同意检测服务协议与知情同意书</Text>
          <NutSwitch checked={consentGiven} onChange={(value) => setConsentGiven(value)} />
        </View>
        {error ? <Text className="error">{error}</Text> : null}
        <View className="field-gap" />
        <NutButton
          block
          type="primary"
          loading={loading}
          disabled={boxUnavailable}
          onClick={() => void submit()}
        >
          激活
        </NutButton>
        <View className="action-gap" />
        <NutButton block fill="outline" onClick={() => go('/pages/profile/index')}>
          去完成实名认证
        </NutButton>
      </View>

      {result ? (
        <View className="card">
          <Text className="section-title">激活成功</Text>
          <Text>样本编号：{result.sample.sampleNo}</Text>
          <Text className="muted">归属类型：{result.ownership.channelType}</Text>
          <Text className="muted">盒码：{result.ownership.sourceBoxCode}</Text>
          <Text className="muted">
            报告授权：{result.consent.reportAuthorization ? '已授权' : '未授权'} · 同意书 v
            {result.consent.templateVersion}
          </Text>
          <View className="field-gap" />
          <NutButton block type="primary" onClick={() => go('/pages/reports/index')}>
            查看我的报告
          </NutButton>
        </View>
      ) : null}
    </View>
  )
}
