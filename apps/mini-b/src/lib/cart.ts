import Taro from '@tarojs/taro'

/** 采购车本地持久化（§6.2：体量小，不引入状态库） */
export const CART_KEY = 'mall_b_cart_v1'

export type CartMap = Record<string, number>

export function readCart(): CartMap {
  try {
    return (Taro.getStorageSync(CART_KEY) as CartMap) ?? {}
  } catch {
    return {}
  }
}

export function writeCart(cart: CartMap): void {
  Taro.setStorageSync(CART_KEY, cart)
}

export function cartCount(cart: CartMap): number {
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0)
}
