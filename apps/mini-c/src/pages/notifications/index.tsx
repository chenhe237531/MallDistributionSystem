import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { api, ensureLogin, go } from '../../lib/api'

type Notification = {
  id: string
  type: string
  title: string
  body: string
  channel: string
  status: string
  failureReason?: string | null
  createdAt: string
}

type NotificationList = {
  unread: number
  items: Notification[]
}

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)

  const load = async () => {
    const result = await api<NotificationList>('/notifications/me')
    setItems(result.items)
    setUnread(result.unread)
  }

  useEffect(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
    })
  }, [])

  const read = async (item: Notification) => {
    if (item.status === 'read') {
      return
    }
    try {
      await api(`/notifications/${item.id}/read`, { method: 'POST', data: {} })
      await load()
    } catch (cause) {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '操作失败', icon: 'none' })
    }
  }

  return (
    <View className="page">
      <View className="hero">
        <Text className="hero-role">消息中心</Text>
        <Text className="hero-title">{unread} 条未读</Text>
        <Text className="hero-status">支付、发货、收样、报告与解读通知</Text>
      </View>

      <View className="section">
        {items.length === 0 ? <Text className="muted">暂无消息</Text> : null}
        {items.map((item) => (
          <View key={item.id} className="card" onClick={() => void read(item)}>
            <View className="row">
              <Text>{item.title}</Text>
              <Text className="tag">{item.status === 'read' ? '已读' : '未读'}</Text>
            </View>
            <Text>{item.body}</Text>
            <Text className="muted">
              {new Date(item.createdAt).toLocaleString('zh-CN')} · {item.channel}
            </Text>
            {item.failureReason ? <Text className="muted">{item.failureReason}</Text> : null}
            {item.type === 'report_ready' || item.type === 'report_shared' ? (
              <Text className="tag" onClick={() => go('/pages/reports/index')}>
                查看报告
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  )
}