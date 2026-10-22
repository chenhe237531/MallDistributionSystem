export const CENTS_PER_YUAN = 100

/**
 * 金额以「分」为单位存储，展示时格式化为两位小数。
 */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(cents))
  const yuan = Math.floor(abs / CENTS_PER_YUAN)
  const fen = abs % CENTS_PER_YUAN
  return `${sign}${yuan}.${fen.toString().padStart(2, '0')}`
}

/**
 * 按比例计算金额，结果四舍五入到分。
 */
export function applyRate(baseCents: number, rate: number): number {
  return Math.round(baseCents * rate)
}

/**
 * 把用户输入的元金额解析为分，非法输入返回 null。
 */
export function parseYuanToCents(input: string): number | null {
  const trimmed = input.trim()
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null
  }
  return Math.round(Number(trimmed) * CENTS_PER_YUAN)
}
