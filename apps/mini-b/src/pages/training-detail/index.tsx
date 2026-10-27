import { useState } from 'react'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import {
  TRAINING_STATUS_LABELS,
  TRAINING_STATUS_TONES,
  statusLabel,
} from '@mall/shared'
import { Button as NutButton, Empty, Progress, Tag } from '@nutui/nutui-react-taro'
import { api, ensureLogin } from '../../lib/api'
import { PageToast, toast } from '../../components/feedback'
import { useTheme } from '../../lib/theme'

type Chapter = { id: string; title: string; content: string; order: number }

type Material = {
  id: string
  title: string
  sourceFile: string
  format: string
  kind: string
  summary: string
  tags: string[]
  pageCount: number
  charCount: number
  sectionCount: number
  outline: Array<{ index: number; title: string }>
  cover?: string
  durationSeconds?: number
  imageBased?: boolean
}

type LearningRecord = {
  id: string
  status: string
  progress: number
  examScore: number | null
  completedChapterIds: string[]
  expiresAt?: string | null
}

type CourseDetail = {
  id: string
  code: string
  name: string
  category: string
  required: boolean
  validityMonths: number
  chapters: Chapter[]
  record: LearningRecord | null
  materials: Material[]
}

const FORMAT_LABELS: Record<string, string> = {
  pptx: 'PPT',
  pdf: 'PDF',
  docx: 'DOC',
  mp4: '视频',
}

const KIND_LABELS: Record<string, string> = {
  slides: '课件',
  report: '报告模板',
  handout: '手册',
  form: '表单',
  video: '视频',
}

const formatMeta = (material: Material) => {
  if (material.format === 'mp4') {
    const minutes = Math.round((material.durationSeconds ?? 0) / 60)
    return `时长 ${minutes > 0 ? `${minutes} 分钟` : `${material.durationSeconds ?? 0} 秒`}`
  }
  const pages = material.pageCount > 0 ? `${material.pageCount} 页 · ` : ''
  return `${pages}共 ${material.sectionCount} 节`
}

export default function TrainingDetail() {
  const { themeClass } = useTheme()
  const router = useRouter()
  const courseId = router.params.id ?? ''
  const [detail, setDetail] = useState<CourseDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [openChapterId, setOpenChapterId] = useState('')
  const [notFound, setNotFound] = useState(false)

  const load = async () => {
    if (!courseId) {
      setNotFound(true)
      return
    }
    try {
      setDetail(await api<CourseDetail>(`/training/courses/${courseId}`))
    } catch (cause) {
      setNotFound(true)
      toast(cause instanceof Error ? cause.message : '课程加载失败', 'fail')
    }
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void load()
  })

  const completedIds = detail?.record?.completedChapterIds ?? []
  const chapters = detail?.chapters ?? []
  const nextChapter = chapters.find((chapter) => !completedIds.includes(chapter.id))
  const finished = chapters.length > 0 && completedIds.length >= chapters.length

  const completeChapter = async (chapterId: string) => {
    if (!detail?.record) {
      toast('学习记录不存在，请返回列表重新进入')
      return
    }
    setLoading(true)
    try {
      await api(`/training/records/${detail.record.id}/chapters/${chapterId}/complete`, {
        method: 'POST',
        data: {},
      })
      toast('章节已完成', 'success')
      await load()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const openMaterial = (materialId: string) => {
    void Taro.navigateTo({
      url: `/pages/training-material/index?id=${materialId}&courseId=${courseId}`,
    })
  }

  if (notFound) {
    return (
      <View className={`page ${themeClass}`}>
        <Empty description="课程不存在或无权查看" />
        <PageToast />
      </View>
    )
  }

  if (!detail) {
    return <View className={`page ${themeClass}`} />
  }

  return (
    <View className={`page ${themeClass}`}>
      <View className="tr-hero">
        <View className="tr-hero-top">
          <Text className="tr-hero-title">{detail.name}</Text>
          <Tag type={TRAINING_STATUS_TONES[detail.record?.status ?? 'not_started'] ?? 'default'}>
            {statusLabel(TRAINING_STATUS_LABELS, detail.record?.status ?? 'not_started')}
          </Tag>
        </View>
        <Progress
          percent={Math.max(0, Math.min(100, detail.record?.progress ?? 0))}
          showText
          color="var(--mall-primary)"
        />
        <View className="tr-hero-meta">
          <Text className="tr-hero-meta-item">{detail.required ? '必修课程' : '选修课程'}</Text>
          <Text className="tr-hero-meta-item">有效期 {detail.validityMonths} 个月</Text>
          <Text className="tr-hero-meta-item">
            {completedIds.length}/{chapters.length} 章已完成
          </Text>
          <Text className="tr-hero-meta-item">{detail.materials.length} 份配套课件</Text>
        </View>
        {detail.record?.examScore !== null && detail.record?.examScore !== undefined ? (
          <Text className="tr-hero-meta-item">考试 {detail.record.examScore} 分</Text>
        ) : null}
        {nextChapter ? (
          <NutButton
            className="tr-hero-action"
            block
            type="primary"
            fill="outline"
            loading={loading}
            onClick={() => void completeChapter(nextChapter.id)}
          >
            完成下一章节：{nextChapter.title}
          </NutButton>
        ) : (
          <NutButton className="tr-hero-action" block type="primary" disabled>
            {finished ? '章节已完成，请参加考试' : '暂无章节'}
          </NutButton>
        )}
      </View>

      <View className="section">
        <Text className="section-title">课程大纲</Text>
        {chapters.length === 0 ? <Empty description="暂无章节" /> : null}
        {chapters.map((chapter, index) => {
          const done = completedIds.includes(chapter.id)
          const open = openChapterId === chapter.id
          return (
            <View key={chapter.id} className={`tr-chapter${done ? ' tr-chapter-done' : ''}`}>
              <View
                className="tr-chapter-head"
                onClick={() => setOpenChapterId(open ? '' : chapter.id)}
              >
                <Text className="tr-chapter-index">{String(index + 1).padStart(2, '0')}</Text>
                <Text className="tr-chapter-title">{chapter.title}</Text>
                <Text className={done ? 'tr-chapter-state tr-chapter-state-done' : 'tr-chapter-state'}>
                  {done ? '已完成' : open ? '收起' : '展开'}
                </Text>
              </View>
              {open ? (
                <View className="tr-chapter-body">
                  <Text className="tr-paragraph">{chapter.content}</Text>
                  {done ? null : (
                    <NutButton
                      className="tr-chapter-action"
                      size="small"
                      type="primary"
                      fill="outline"
                      loading={loading}
                      onClick={() => void completeChapter(chapter.id)}
                    >
                      标记本章已完成
                    </NutButton>
                  )}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>

      <View className="section">
        <Text className="section-title">课程内容 · 配套课件</Text>
        <Text className="tr-hint">解析自「百依诺商家资料」目录，按原文档章节还原，点击查看全文</Text>
        {detail.materials.length === 0 ? <Empty description="暂无配套课件" /> : null}
        {detail.materials.map((material) => (
          <View key={material.id} className="tr-material" onClick={() => openMaterial(material.id)}>
            <View className="tr-material-head">
              <Text className="tr-material-badge">{FORMAT_LABELS[material.format] ?? material.format}</Text>
              <Text className="tr-material-title">{material.title}</Text>
              <Text className="tr-material-arrow">›</Text>
            </View>
            <Text className="tr-material-summary">{material.summary}</Text>
            <View className="tr-material-meta">
              <Text className="tr-material-meta-item">{KIND_LABELS[material.kind] ?? material.kind}</Text>
              <Text className="tr-material-meta-item">{formatMeta(material)}</Text>
              {material.imageBased ? <Text className="tr-material-meta-item">图片版</Text> : null}
            </View>
            {material.tags.length > 0 ? (
              <View className="tr-material-tags">
                {material.tags.map((tag) => (
                  <Text key={tag} className="tr-material-tag">
                    {tag}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <PageToast />
    </View>
  )
}
