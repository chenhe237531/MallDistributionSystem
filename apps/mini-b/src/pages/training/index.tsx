import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { TRAINING_STATUS_LABELS, TRAINING_STATUS_TONES, statusLabel } from '@mall/shared'
import { api, ensureLogin } from '../../lib/api'
import {
  Button as NutButton,
  Empty,
  Progress,
  Tag,
  Toast,
} from '@nutui/nutui-react-taro'
import { useTheme } from '../../lib/theme'

type Record = {
  id: string
  status: string
  progress: number
  examScore: number | null
  completedChapterIds: string[]
  course: { id: string; name: string; chapters: Array<{ id: string; title: string }> }
}

const toast = (title: string, icon?: 'success' | 'fail') =>
  Toast.show('b-toast', { title, icon })

export default function Training() {
  const { themeClass } = useTheme()
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setRecords(await api<Record[]>('/training/me'))
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
    })
  })

  const completeNext = async (record: Record) => {
    const next = record.course.chapters.find(
      (chapter) => !record.completedChapterIds.includes(chapter.id),
    )
    if (!next) {
      toast('章节已完成，请参加考试')
      return
    }
    setLoading(true)
    try {
      await api(`/training/records/${record.id}/chapters/${next.id}/complete`, {
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

  return (
    <View className={`page ${themeClass}`}>
      <View className="section">
        <Text className="section-title">我的学习</Text>
        {records.length === 0 ? <Empty description="暂无学习任务" /> : null}
        {records.map((record) => (
          <View key={record.id} className="card">
            <View className="row">
              <Text className="train-name">{record.course.name}</Text>
              <Tag type={TRAINING_STATUS_TONES[record.status] ?? 'default'}>
                {statusLabel(TRAINING_STATUS_LABELS, record.status)}
              </Tag>
            </View>
            <View className="train-progress">
              <Progress
                percent={Math.max(0, Math.min(100, record.progress))}
                showText
                color="#1677ff"
              />
            </View>
            <Text className="muted">
              进度 {record.progress}%
              {record.examScore !== null ? ` · 考试 ${record.examScore} 分` : ''}
            </Text>
            {record.status !== 'passed' ? (
              <NutButton
                className="train-action"
                block
                type="primary"
                fill="outline"
                loading={loading}
                onClick={() => void completeNext(record)}
              >
                完成下一章节
              </NutButton>
            ) : null}
          </View>
        ))}
      </View>

      <Toast id="b-toast" />
    </View>
  )
}
