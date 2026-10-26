import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { Icon } from './Icon'

/**
 * 自绘底部 2 Tab 栏（方案 §3.1）：
 * 不走 Taro 原生 tabBar，切换用 redirectTo 防止页面栈增长；仅主页 / 我的挂载。
 */

export type TabKey = 'home' | 'profile'

const TABS: Array<{ key: TabKey; label: string; icon: 'home' | 'user'; url: string }> = [
  { key: 'home', label: '主页', icon: 'home', url: '/pages/index/index' },
  { key: 'profile', label: '我的', icon: 'user', url: '/pages/profile/index' },
]

export function AppTabbar({ active }: { active: TabKey }) {
  const switchTab = (tab: (typeof TABS)[number]) => {
    if (tab.key === active) {
      return
    }
    void Taro.redirectTo({ url: tab.url })
  }

  return (
    <View className="b-tabbar">
      {TABS.map((tab) => (
        <View
          key={tab.key}
          className={`b-tabbar-item ${tab.key === active ? 'b-tabbar-item-active' : ''}`}
          role="button"
          aria-label={tab.label}
          onClick={() => switchTab(tab)}
        >
          <Icon name={tab.icon} size={22} />
          <Text className="b-tabbar-label">{tab.label}</Text>
        </View>
      ))}
    </View>
  )
}
