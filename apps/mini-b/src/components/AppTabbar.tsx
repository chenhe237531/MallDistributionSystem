import Taro from '@tarojs/taro'
import { View } from '@tarojs/components'
import { Icon, type IconName } from './Icon'
import { cartCount, readCart } from '../lib/cart'

/**
 * 自绘底部 4 Tab 栏（改版 §5，决策点 D2）：
 * 不走 Taro 原生 tabBar（免 8 张图标资源、H5 表现可控）；
 * 仅在 4 个 tab 页挂载，切换用 redirectTo 防止页面栈增长。
 * 消息入口移至各页右上角铃铛；第 3 位为购物车（带数量角标）。
 */

export type TabKey = 'home' | 'mall' | 'cart' | 'profile'

const TABS: Array<{ key: TabKey; label: string; icon: IconName; url: string }> = [
  { key: 'home', label: '首页', icon: 'home', url: '/pages/index/index' },
  { key: 'mall', label: '采购商城', icon: 'shop', url: '/pages/procurement/index' },
  { key: 'cart', label: '购物车', icon: 'cart', url: '/pages/cart/index' },
  { key: 'profile', label: '我的', icon: 'user', url: '/pages/profile/index' },
]

export function AppTabbar({ active }: { active: TabKey }) {
  const switchTab = (tab: (typeof TABS)[number]) => {
    if (tab.key === active) {
      return
    }
    void Taro.redirectTo({ url: tab.url })
  }

  const count = cartCount(readCart())

  return (
    <View className="b-tabbar">
      {TABS.map((tab) => (
        <View
          key={tab.key}
          className={`b-tabbar-item ${tab.key === active ? 'b-tabbar-item-active' : ''}`}
          onClick={() => switchTab(tab)}
        >
          <View style={{ position: 'relative' }}>
            <Icon name={tab.icon} size={22} />
            {tab.key === 'cart' && count > 0 ? (
              <View className="b-tabbar-badge">{count > 99 ? '99+' : count}</View>
            ) : null}
          </View>
          <View className="b-tabbar-label">{tab.label}</View>
        </View>
      ))}
    </View>
  )
}
