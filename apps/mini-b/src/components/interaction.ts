export function isButtonInert(disabled = false, loading = false): boolean {
  return disabled || loading
}

export function tabAccessibilityLabel(label: string, active: boolean, count = 0): string {
  const parts = [label]
  if (active) {
    parts.push('当前页')
  }
  if (count > 99) {
    parts.push('99 件以上')
  } else if (count > 0) {
    parts.push(`${count} 件商品`)
  }
  return parts.join('，')
}
