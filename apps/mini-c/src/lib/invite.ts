/** 商家邀请码解析：支持直接输入邀请码或扫描商家二维码（载荷 INVITE:XXXX 或 ...?code=XXXX） */
export function normalizeInviteInput(raw: string): string {
  const value = raw.trim()
  if (!value) {
    return ''
  }
  // 优先取 URL query 中的 code 参数
  const queryMatch = value.match(/[?&]code=([A-Za-z0-9-]+)/)
  if (queryMatch) {
    return queryMatch[1].toUpperCase()
  }
  // 去掉 INVITE: 前缀
  const inviteMatch = value.match(/^INVITE[:：]([A-Za-z0-9-]+)$/i)
  if (inviteMatch) {
    return inviteMatch[1].toUpperCase()
  }
  return value.replace(/[\s-]/g, '').toUpperCase()
}
