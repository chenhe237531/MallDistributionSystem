import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, Textarea, View } from '@tarojs/components'
import {
  Button as NutButton,
  Input as NutInput,
} from '@nutui/nutui-react-taro'
import { PageToast, toast } from '../../components/feedback'
import { StepFlow } from '../../components/StepFlow'
import { api, ensureLogin, go, routeParams } from '../../lib/api'
import {
  DEFAULT_QUESTIONS,
  QUESTIONNAIRE_INTRO,
  fromProductFields,
  type Question,
} from '../../lib/questionnaire'
import {
  isQuestionnaireDone,
  type SampleRecord,
} from '../../lib/sample'

type Answers = Record<string, string | string[]>

type ProductPreview = {
  product: {
    questionnaireFields:
      | Array<{
          key: string
          label?: string
          type?: Question['type']
          required?: boolean
          options?: string[]
          exclusiveOptions?: string[]
          remarkOn?: string[]
          unit?: string
          placeholder?: string
        }>
      | null
  }
}

type Me = { name: string; realName: string | null }

function isAnswered(value: string | string[] | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value && value.trim())
}

function remarkKey(key: string): string {
  return `${key}Remark`
}

export default function Questionnaire() {
  const params = routeParams()
  const [sample, setSample] = useState<SampleRecord | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answers>({})
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const [readOnly, setReadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ensureLogin()) {
      return
    }
    void load()
    // 仅首次进入加载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      let current: SampleRecord | null = null
      if (params.sampleId) {
        current = await api<SampleRecord>(`/samples/${params.sampleId}`)
      } else {
        const mine = await api<SampleRecord[]>('/samples/me')
        current =
          mine.find((item) => item.status === 'activated' && !isQuestionnaireDone(item)) ??
          mine.find((item) => item.status === 'activated') ??
          null
      }
      if (!current) {
        setSample(null)
        return
      }
      setSample(current)

      let questionList = DEFAULT_QUESTIONS
      if (current.boxCode?.code) {
        try {
          const preview = await api<ProductPreview>(
            `/box-codes/preview/${encodeURIComponent(current.boxCode.code)}`,
          )
          if (preview.product.questionnaireFields && preview.product.questionnaireFields.length > 0) {
            questionList = fromProductFields(preview.product.questionnaireFields)
          }
        } catch {
          questionList = DEFAULT_QUESTIONS
        }
      }
      setQuestions(questionList)

      const me = await api<Me>('/customers/me').catch(() => null)
      const existing = (current.questionnaire ?? {}) as Record<string, unknown>
      const initial: Answers = {}
      const initialRemarks: Record<string, string> = {}

      for (const question of questionList) {
        const raw = existing[question.key]
        let value: string | string[] = ''
        if (question.type === 'checkbox') {
          value = Array.isArray(raw) ? raw.map(String) : []
        } else if (raw !== undefined && raw !== null && raw !== '') {
          value = String(raw)
        }
        if (question.key === 'sampleNo') {
          value = current.sampleNo
        }
        if (question.key === 'phone' && !value) {
          value = current.contactPhone ?? params.phone ?? ''
        }
        if (question.key === 'age' && !value) {
          value = current.examineeAge ? String(current.examineeAge) : (params.age ?? '')
        }
        if (question.key === 'name' && !value) {
          value = me?.realName ?? me?.name ?? ''
        }
        initial[question.key] = value
        const storedRemark = existing[remarkKey(question.key)]
        if (typeof storedRemark === 'string' && storedRemark) {
          initialRemarks[question.key] = storedRemark
        }
      }
      setAnswers(initial)
      setRemarks(initialRemarks)
      setReadOnly(isQuestionnaireDone(current) || current.status !== 'activated')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const setAnswer = (key: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  const toggleOption = (question: Question, option: string) => {
    if (readOnly) {
      return
    }
    const current = Array.isArray(answers[question.key]) ? (answers[question.key] as string[]) : []
    const isExclusive = question.exclusiveOptions?.includes(option) ?? false
    let next: string[]
    if (isExclusive) {
      next = current.includes(option) ? [] : [option]
    } else {
      const filtered = question.exclusiveOptions
        ? current.filter((item) => !question.exclusiveOptions!.includes(item))
        : current
      next = filtered.includes(option)
        ? filtered.filter((item) => item !== option)
        : [...filtered, option]
    }
    setAnswer(question.key, next)

    // 取消勾选后清空对应备注
    if (question.remarkOn && question.remarkOn.some((item) => !next.includes(item))) {
      setRemarks((prev) => ({ ...prev, [question.key]: '' }))
    }
  }

  const shouldShowRemark = (question: Question): boolean => {
    if (!question.remarkOn) {
      return false
    }
    const value = answers[question.key]
    if (Array.isArray(value)) {
      return value.some((item) => question.remarkOn!.includes(item))
    }
    return typeof value === 'string' && question.remarkOn.includes(value)
  }

  const submit = async () => {
    if (!sample || readOnly) {
      return
    }
    const missing = questions.find((question) => question.required && !isAnswered(answers[question.key]))
    if (missing) {
      setError(`请完成第 ${questions.indexOf(missing) + 1} 题：${missing.label}`)
      void Taro.pageScrollTo({ selector: `#q-${missing.key}`, duration: 300 })
      return
    }

    const numericRules: Record<string, [number, number]> = {
      age: [1, 120],
      heightCm: [50, 250],
      weightKg: [2, 300],
    }
    for (const question of questions) {
      if (question.key === 'phone') {
        const phone = String(answers[question.key] ?? '').trim()
        if (phone && !/^1\d{10}$/.test(phone)) {
          setError('联系方式（手机号码）格式不正确')
          void Taro.pageScrollTo({ selector: '#q-phone', duration: 300 })
          return
        }
      }
      const range = numericRules[question.key]
      if (!range) {
        continue
      }
      const raw = String(answers[question.key] ?? '').trim()
      if (!raw) {
        continue
      }
      const number = Number(raw)
      if (!Number.isInteger(number) || number < range[0] || number > range[1]) {
        setError(`${question.label}需填写 ${range[0]}–${range[1]} 的整数`)
        void Taro.pageScrollTo({ selector: `#q-${question.key}`, duration: 300 })
        return
      }
    }

    const payload: Record<string, unknown> = {}
    for (const question of questions) {
      const value = answers[question.key]
      if (question.type === 'checkbox') {
        payload[question.key] = Array.isArray(value) ? value : []
      } else if (question.type === 'number') {
        const text = String(value ?? '').trim()
        payload[question.key] = text ? Number(text) : ''
      } else {
        payload[question.key] = String(value ?? '').trim()
      }
      const remark = remarks[question.key]?.trim()
      if (remark) {
        payload[remarkKey(question.key)] = remark
      }
    }

    setSubmitting(true)
    setError('')
    try {
      await api(`/samples/${sample.id}/questionnaire`, {
        method: 'PATCH',
        data: { answers: payload },
      })
      toast('问卷已提交', 'success')
      setTimeout(() => {
        void Taro.redirectTo({ url: '/pages/progress/index' })
      }, 600)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View className="page">
        <Text className="muted">加载中…</Text>
      </View>
    )
  }

  if (!sample) {
    return (
      <View className="page">
        <View className="empty-state">
          <View className="empty-icon">
            <Text>?</Text>
          </View>
          <Text className="empty-title">暂无可填写问卷的样本</Text>
          <Text className="empty-desc">请先绑定检测盒，绑定成功后将自动进入健康问卷。</Text>
          <View className="action-gap" />
          <NutButton type="primary" onClick={() => go('/pages/activate/index')}>
            去绑定样本
          </NutButton>
        </View>
      </View>
    )
  }

  const done = isQuestionnaireDone(sample)

  return (
    <View className="page">
      <PageToast />
      <StepFlow status={sample.status} questionnaireDone={done} />

      <View className="info-card">
        <Text className="info-card-title">填写须知</Text>
        {QUESTIONNAIRE_INTRO.map((item, index) => (
          <Text key={item}>
            {index + 1}. {item}
          </Text>
        ))}
      </View>

      <View className="card">
        <View className="row">
          <Text>样本编号</Text>
          <Text>{sample.sampleNo}</Text>
        </View>
        <Text className="muted">
          {readOnly
            ? '问卷已提交，本页为只读回看。如需修改请联系客服。'
            : '请完整、客观填写以下健康信息，提交后将随样本归档用于报告解读。'}
        </Text>
      </View>

      {questions.map((question, index) => {
        const value = answers[question.key]
        return (
          <View key={question.key} id={`q-${question.key}`} className="q-card">
            <Text className="q-label">
              <Text className="q-index">Q{index + 1}</Text>
              {question.required ? <Text className="field-required">*</Text> : null}
              {question.label}
            </Text>

            {question.type === 'radio' ? (
              <View className="pill-group">
                {(question.options ?? []).map((option) => (
                  <View
                    key={option}
                    className={`pill ${value === option ? 'pill-active' : ''} ${readOnly ? 'pill-readonly' : ''}`}
                    role="radio"
                    aria-checked={value === option}
                    onClick={() => {
                      if (!readOnly) {
                        setAnswer(question.key, option)
                      }
                    }}
                  >
                    <Text>{option}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {question.type === 'checkbox' ? (
              <View className="pill-group">
                {(question.options ?? []).map((option) => {
                  const selected = Array.isArray(value) && value.includes(option)
                  return (
                    <View
                      key={option}
                      className={`pill ${selected ? 'pill-active' : ''} ${readOnly ? 'pill-readonly' : ''}`}
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => toggleOption(question, option)}
                    >
                      <Text>{option}</Text>
                    </View>
                  )
                })}
              </View>
            ) : null}

            {question.type === 'text' || question.type === 'number' ? (
              readOnly ? (
                <Text className="q-readonly-value">{String(value ?? '') || '未填写'}</Text>
              ) : (
                <NutInput
                  type={question.type === 'number' ? 'number' : 'text'}
                  value={String(value ?? '')}
                  disabled={question.readonly}
                  placeholder={question.placeholder ?? '请输入'}
                  clearable={!question.readonly}
                  onChange={(next) => setAnswer(question.key, next)}
                />
              )
            ) : null}

            {question.type === 'textarea' ? (
              readOnly ? (
                <Text className="q-readonly-value">{String(value ?? '') || '未填写'}</Text>
              ) : (
                <Textarea
                  className="textarea-field"
                  value={String(value ?? '')}
                  maxlength={500}
                  placeholder={question.placeholder ?? '请输入'}
                  onInput={(event) => setAnswer(question.key, event.detail.value)}
                />
              )
            ) : null}

            {question.unit ? <Text className="field-tip">单位：{question.unit}</Text> : null}

            {shouldShowRemark(question) ? (
              readOnly ? (
                <Text className="q-readonly-value">
                  备注：{remarks[question.key] || '未填写'}
                </Text>
              ) : (
                <View className="q-remark">
                  <NutInput
                    value={remarks[question.key] ?? ''}
                    placeholder="请补充备注"
                    clearable
                    onChange={(next) =>
                      setRemarks((prev) => ({ ...prev, [question.key]: next }))
                    }
                  />
                </View>
              )
            ) : null}
          </View>
        )
      })}

      {error ? <Text className="error">{error}</Text> : null}

      {readOnly ? (
        <View className="action-gap">
          <NutButton block type="primary" onClick={() => go('/pages/progress/index')}>
            查看检测进度
          </NutButton>
        </View>
      ) : (
        <>
          <View className="bottom-bar-placeholder" />
          <View className="bottom-bar">
            <NutButton
              block
              type="primary"
              loading={submitting}
              onClick={() => void submit()}
            >
              提交问卷
            </NutButton>
          </View>
        </>
      )}
    </View>
  )
}
