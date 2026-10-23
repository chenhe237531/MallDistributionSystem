import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import { api, ensureLogin } from '../../lib/api'

type Record = {
  id: string
  status: string
  progress: number
  examScore: number | null
  completedChapterIds: string[]
  course: { id: string; name: string; chapters: Array<{ id: string; title: string }> }
}

export default function Training() {
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
      void Taro.showToast({ title: '章节已完成，请参加考试', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      await api(`/training/records/${record.id}/chapters/${next.id}/complete`, {
        method: 'POST',
        data: {},
      })
      void Taro.showToast({ title: '章节已完成', icon: 'success' })
      await load()
    } catch (cause) {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '操作失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="page">
      <View className="section">
        <Text className="section-title">我的学习</Text>
        {records.length === 0 ? <Text className="muted">暂无学习任务</Text> : null}
        {records.map((record) => (
          <View key={record.id} className="card">
            <View className="row">
              <Text>{record.course.name}</Text>
              <Text className="tag">{record.status}</Text>
            </View>
            <Text className="muted">
              进度 {record.progress}%
              {record.examScore !== null ? ` · 考试 ${record.examScore} 分` : ''}
            </Text>
            {record.status !== 'passed' ? (
              <Button className="btn-secondary" loading={loading} onClick={() => void completeNext(record)}>
                完成下一章节
              </Button>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  )
}
