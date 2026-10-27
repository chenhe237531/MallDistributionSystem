import Taro from '@tarojs/taro'

/** C 端收货地址（检测盒寄送），与后端 ShippingAddress 对应 */
export type ShippingAddress = {
  id: string
  receiverName: string
  receiverPhone: string
  region: string
  detail: string
  isDefault: boolean
}

export const PHONE_PATTERN = /^1\d{10}$/

/**
 * 订单页 ↔ 地址簿页的选择回传通道：
 * navigateBack 无法直接传参，且本项目 H5 构建下 useDidShow 存在
 * React.useContext 运行时缺陷（白屏），故用 Taro 事件总线回传。
 */
const ADDRESS_SELECTED_EVENT = 'address:selected'

export function fullAddressText(address: Pick<ShippingAddress, 'region' | 'detail'>): string {
  return [address.region, address.detail].filter(Boolean).join(' ')
}

export function emitAddressSelected(address: ShippingAddress): void {
  Taro.eventCenter.trigger(ADDRESS_SELECTED_EVENT, address)
}

/** 返回取消订阅函数 */
export function onAddressSelected(handler: (address: ShippingAddress) => void): () => void {
  Taro.eventCenter.on(ADDRESS_SELECTED_EVENT, handler)
  return () => Taro.eventCenter.off(ADDRESS_SELECTED_EVENT, handler)
}
