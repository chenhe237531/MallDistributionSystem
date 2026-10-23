import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { api, ensureLogin } from '../../lib/api'
import { Cell, CellGroup, Empty, Tag, Toast } from '@nutui/nutui-react-taro'

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

const toast = (title: string, icon?: 'success' | 'fail') =>
  Toast.show('b-toast', { title, icon })

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)

  const load = async () => {
    const result = await api<NotificationList>('/notifications/me')
    setItems(result.items)
    setUnread(result.unread)
  }

  useDidShow(() => {
    if (!ensureLogin()) {
      return
    }
    void load().catch((cause) => {
      void Taro.showToast({ title: cause instanceof Error ? cause.message : '加载失败', icon: 'none' })
    })
  })

  const read = async (item: Notification) => {
    if (item.status === 'read') {
      return
    }
    try {
      await api(`/notifications/${item.id}/read`, { method: 'POST', data: {} })
      await load()
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '操作失败')
    }
  }

  return (
    <View className="page">
      <View className="hero">
        <Text className="hero-role">消息中心</Text>
        <Text className="hero-title">{unread} 条未读</Text>
        <Text className="hero-status">仅提示报告已生成，不展示指标数值与结论</Text>
      </View>

      <View className="section">
        <Text className="section-title">全部消息</Text>
        {items.length === 0 ? (
          <Empty description="暂无消息" />
        ) : (
          <CellGroup>
            {items.map((item) => (
              <Cell
                key={item.id}
                clickable={item.status !== 'read'}
                onClick={() => void read(item)}
                title={item.title}
                description={
                  <View className="notif-desc">
                    <Text className="notif-body">{item.body}</Text>
                    <Text className="muted">
                      {new Date(item.createdAt).toLocaleString('zh-CN')} · {item.channel}
                    </Text>
                    {item.failureReason ? <Text className="muted">{item.failureReason}</Text> : null}
                  </View>
                }
                extra={
                  <Tag type={item.status === 'read' ? 'default' : 'primary'}>
                    {item.status === 'read' ? '已读' : '未读'}
                  </Tag>
                }
              />
            ))}
          </CellGroup>
        )}
      </View>

      <Toast id="b-toast" />
    </View>
  )
}
