import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Picker, Text, Textarea, Video, View } from '@tarojs/components'
import {
  Button as NutButton,
  Input as NutInput,
  Switch as NutSwitch,
  Toast,
} from '@nutui/nutui-react-taro'
import { Icon } from '../../components/Icon'
import { StepFlow } from '../../components/StepFlow'
import { api, ensureLogin, go, routeParams } from '../../lib/api'
import { CONSENT_PLACEHOLDER } from '../../lib/content'
import { RELATIONSHIP_LABELS } from '../../lib/sample'

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
  }
}

type ActivationResult = {
  sample: { id: string; sampleNo: string; status: string }
}

type Me = {
  phone: string
  name: string
  realName: string | null
}

const STATUS_LABELS: Record<string, string> = {
  generated: '待激活',
  active: '已激活',
  used: '已使用',
  voided: '已作废',
}

const RELATIONSHIP_KEYS = ['self', 'spouse', 'parent', 'child', 'other']

function todayString(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export default function Activate() {
  const params = routeParams()
  const [boxCode, setBoxCode] = useState(params.code ?? '')
  const orderId = params.orderId ?? ''
  const [sampledAt, setSampledAt] = useState(todayString())
  const [contactPhone, setContactPhone] = useState('')
  const [relationship, setRelationship] = useState('self')
  const [age, setAge] = useState('')
  const [remark, setRemark] = useState('')
  const [preview, setPreview] = useState<BoxPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [consentDialog, setConsentDialog] = useState(false)
  const [consentOpened, setConsentOpened] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const [reportAuthorization, setReportAuthorization] = useState(true)
  const [realName, setRealName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const boxUnavailable = preview !== null && preview.status !== 'generated'

  useEffect(() => {
    if (!ensureLogin()) {
      return
    }
    void api<Me>('/customers/me')
      .then((me) => {
        setRealName(me.realName ?? '')
        if (!contactPhone) {
          setContactPhone(me.phone ?? '')
        }
      })
      .catch(() => undefined)
    // 仅在首次进入时带入账号手机号
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const queryPreview = async (code = boxCode) => {
    const normalized = code.trim().toUpperCase()
    if (!normalized) {
      setError('请先输入样本编号')
      return
    }
    setPreviewing(true)
    setError('')
    try {
      const data = await api<BoxPreview>(`/box-codes/preview/${encodeURIComponent(normalized)}`)
      setPreview(data)
    } catch (cause) {
      setPreview(null)
      setError(cause instanceof Error ? cause.message : '盒码查询失败')
    } finally {
      setPreviewing(false)
    }
  }

  const scanCode = () => {
    if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
      Toast.show('activate-toast', { title: 'H5 暂不支持扫码，请手动输入样本编号' })
      return
    }
    void Taro.scanCode({})
      .then((result) => {
        const code = result.result.trim().toUpperCase()
        setBoxCode(code)
        void queryPreview(code)
      })
      .catch(() => undefined)
  }

  const submit = async () => {
    if (!ensureLogin()) {
      return
    }
    if (!boxCode.trim()) {
      setError('请填写样本编号')
      return
    }
    if (!sampledAt) {
      setError('请选择采样时间')
      return
    }
    if (!/^1\d{10}$/.test(contactPhone.trim())) {
      setError('请填写正确的手机号')
      return
    }
    if (!relationship) {
      setError('请选择与受检人关系')
      return
    }
    const ageNumber = Number(age)
    if (!Number.isInteger(ageNumber) || ageNumber < 1 || ageNumber > 120) {
      setError('请填写 1–120 的受检人年龄')
      return
    }
    if (!consentGiven) {
      setError('请查看并勾选同意检测服务协议与知情同意书')
      return
    }
    if (boxUnavailable) {
      setError('该盒已激活或已作废')
      return
    }

    setLoading(true)
    setError('')
    try {
      const activated = await api<ActivationResult>('/box-codes/activate', {
        method: 'POST',
        data: {
          boxCode: boxCode.trim().toUpperCase(),
          orderId: orderId.trim() || undefined,
          sampledAt,
          contactPhone: contactPhone.trim(),
          relationship,
          examineeAge: ageNumber,
          remark: remark.trim() || undefined,
          consentGiven,
          reportAuthorization,
          samplingMethod: 'self_mail',
          device: 'mini-c-h5',
        },
      })
      // D3：绑定成功后强制续填问卷（向导 Step2）
      void Taro.redirectTo({
        url: `/pages/questionnaire/index?sampleId=${activated.sample.id}&sampleNo=${activated.sample.sampleNo}&phone=${contactPhone.trim()}&age=${ageNumber}`,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '激活失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      <Toast id="activate-toast" />
      <StepFlow status="binding" />

      <View className="form-card">
        <View className="form-field">
          <Text className="form-field-label">
            <Text className="field-required">*</Text>样本编号
          </Text>
          <View className="box-code-row">
            <View className="box-code-input">
              <NutInput
                value={boxCode}
                placeholder="样本条形码编号"
                clearable
                onChange={(value) => setBoxCode(value)}
                onBlur={(value) => {
                  const normalized = (value || boxCode).trim()
                  if (normalized) {
                    void queryPreview(normalized)
                  }
                }}
              />
            </View>
            <View className="scan-btn" role="button" aria-label="扫码" onClick={scanCode}>
              <Icon name="scan" size={20} />
            </View>
          </View>
          <Text className="field-tip">扫码或手动输入盒码，失焦后自动校验</Text>
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
              {boxUnavailable ? <Text className="error">该盒已激活或已作废</Text> : null}
            </View>
          ) : null}
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
        </View>

        {preview?.product.guideVideoUrl ? (
          <View className="guide-video-block">
            <Text className="guide-video-title">采样指导视频（建议观看后再取样）</Text>
            <View className="guide-video-wrap">
              <Video
                src={preview.product.guideVideoUrl}
                controls
                showCenterPlayBtn
                objectFit="contain"
              />
            </View>
            {preview.product.intro ? (
              <Text className="guide-video-intro">{preview.product.intro}</Text>
            ) : null}
          </View>
        ) : null}

        <View className="form-field">
          <Text className="form-field-label">
            <Text className="field-required">*</Text>采样时间
          </Text>
          <Picker
            mode="date"
            value={sampledAt}
            end={todayString()}
            onChange={(event) => setSampledAt(event.detail.value)}
          >
            <View className={`picker-value ${sampledAt ? '' : 'picker-placeholder'}`}>
              {sampledAt || '请选择采样时间'}
            </View>
          </Picker>
        </View>

        <View className="form-field">
          <Text className="form-field-label">
            <Text className="field-required">*</Text>手机号
          </Text>
          <NutInput
            type="number"
            maxLength={11}
            value={contactPhone}
            placeholder="请输入"
            clearable
            onChange={(value) => setContactPhone(value)}
          />
        </View>

        <View className="form-field">
          <Text className="form-field-label">
            <Text className="field-required">*</Text>与受检人关系
          </Text>
          <View className="pill-group">
            {RELATIONSHIP_KEYS.map((key) => (
              <View
                key={key}
                className={`pill ${relationship === key ? 'pill-active' : ''}`}
                role="radio"
                aria-checked={relationship === key}
                onClick={() => setRelationship(key)}
              >
                <Text>{RELATIONSHIP_LABELS[key]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="form-field">
          <Text className="form-field-label">
            <Text className="field-required">*</Text>受检人年龄
          </Text>
          <NutInput
            type="number"
            maxLength={3}
            value={age}
            placeholder="请输入"
            clearable
            onChange={(value) => setAge(value)}
          />
        </View>

        <View className="form-field">
          <Text className="form-field-label">
            <Text className="field-required">*</Text>知情同意书
          </Text>
          <View className="consent-link" role="button" onClick={() => setConsentDialog(true)}>
            <Text>查看知情同意书</Text>
            <Text>›</Text>
          </View>
          <View
            className="check-row"
            onClick={() => {
              if (!consentOpened) {
                setConsentDialog(true)
                return
              }
              setConsentGiven((value) => !value)
            }}
          >
            <View className={`check-box ${consentGiven ? 'check-box-checked' : ''}`}>
              <Text>{consentGiven ? '✓' : ''}</Text>
            </View>
            <Text className="check-text">已阅读并同意检测服务协议与知情同意书</Text>
          </View>
        </View>

        <View className="form-field">
          <Text className="form-field-label">备注信息</Text>
          <Textarea
            className="textarea-field"
            value={remark}
            maxlength={200}
            placeholder="如有备注信息请输入，没有请忽略!"
            onInput={(event) => setRemark(event.detail.value)}
          />
          <Text className="field-tip">{remark.length}/200</Text>
        </View>
      </View>

      {!realName ? (
        <View className="alert-strip">
          <Text>激活前需完成实名认证</Text>
          <Text className="alert-strip-action" onClick={() => go('/pages/profile/index')}>
            去认证
          </Text>
        </View>
      ) : null}

      <View className="card">
        <View className="row">
          <Text>报告授权给商家/渠道查看</Text>
          <NutSwitch
            checked={reportAuthorization}
            onChange={(value) => setReportAuthorization(value)}
          />
        </View>
      </View>

      {error ? <Text className="error">{error}</Text> : null}

      <View className="action-gap" />
      <NutButton
        block
        type="primary"
        loading={loading}
        disabled={boxUnavailable}
        onClick={() => void submit()}
      >
        绑定
      </NutButton>
      <View className="action-gap" />

      {consentDialog ? (
        <View className="sheet-mask" onClick={() => setConsentDialog(false)}>
          <View className="sheet-panel" onClick={(event) => event.stopPropagation()}>
            <View className="sheet-handle" />
            <Text className="sheet-title">检测服务协议与知情同意书</Text>
            <View className="field-gap" />
            <Text className="muted">{CONSENT_PLACEHOLDER}</Text>
            <View className="field-gap" />
            <NutButton
              block
              type="primary"
              onClick={() => {
                setConsentOpened(true)
                setConsentGiven(true)
                setConsentDialog(false)
              }}
            >
              我已阅读并同意
            </NutButton>
            <View className="action-gap" />
            <NutButton block fill="outline" onClick={() => setConsentDialog(false)}>
              暂不签署
            </NutButton>
          </View>
        </View>
      ) : null}
    </View>
  )
}
