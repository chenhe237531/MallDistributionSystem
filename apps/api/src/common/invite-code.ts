import { randomBytes } from 'node:crypto'
import { BadRequestException } from '@nestjs/common'
import { Role } from '@mall/shared'
import { AccountStatus } from '@prisma/client'
import { asRoleArray } from '../prisma/array-values'
import { PrismaService } from '../prisma/prisma.service'

/** 邀请码字符集：去掉易混淆的 0/O/1/I */
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** 邀请码统一格式：大写、去空格与常见分隔符，兼容二维码原始载荷（INVITE:XXXX / ...?code=XXXX） */
export function normalizeInviteCode(raw: string): string {
  const value = raw.trim()
  if (!value) {
    return ''
  }
  const queryMatch = value.match(/[?&]code=([A-Za-z0-9-]+)/)
  const base = queryMatch ? queryMatch[1] : value.replace(/^INVITE[:：]/i, '')
  return base.toUpperCase().replace(/[\s-]/g, '')
}

/** 生成 8 位唯一邀请码，如 KH7M2X9P */
export async function generateUniqueInviteCode(prisma: PrismaService): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = randomBytes(8)
    let code = ''
    for (const byte of bytes) {
      code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length]
    }
    const existing = await prisma.user.findUnique({ where: { inviteCode: code } })
    if (!existing) {
      return code
    }
  }
  throw new BadRequestException('邀请码生成失败，请重试')
}

export interface InviteInviter {
  id: string
  name: string
  phone: string
  primaryRole: string
  roles: string[]
  organizationId: string | null
}

/**
 * 按邀请码解析商家端用户：仅允许状态正常、已绑定商家组织的商家 / 销售。
 * 无效时统一抛出业务异常，避免暴露账号是否存在。
 */
export async function resolveInviteInviter(
  prisma: PrismaService,
  rawCode: string,
): Promise<InviteInviter> {
  const code = normalizeInviteCode(rawCode)
  if (!code) {
    throw new BadRequestException('请输入商家邀请码')
  }
  const inviter = await prisma.user.findUnique({ where: { inviteCode: code } })
  if (
    !inviter ||
    inviter.status !== AccountStatus.active ||
    !inviter.organizationId ||
    ![Role.MERCHANT, Role.SALES].some((role) => asRoleArray(inviter.roles).includes(role))
  ) {
    throw new BadRequestException('邀请码无效，请核对后重试')
  }
  return {
    id: inviter.id,
    name: inviter.name,
    phone: inviter.phone,
    primaryRole: inviter.primaryRole,
    roles: asRoleArray(inviter.roles),
    organizationId: inviter.organizationId,
  }
}

/** 邀请人是否为销售角色（仅销售会写入客户归属的 salesId） */
export function isSalesInviter(inviter: Pick<InviteInviter, 'roles'>): boolean {
  return inviter.roles.includes(Role.SALES)
}

/** 查询邀请人所属商家组织名称 */
export async function inviterOrganizationName(
  prisma: PrismaService,
  inviter: Pick<InviteInviter, 'organizationId'>,
): Promise<string | null> {
  if (!inviter.organizationId) {
    return null
  }
  const organization = await prisma.organization.findUnique({
    where: { id: inviter.organizationId },
  })
  return organization?.name ?? null
}

/** 判断组织内是否允许绑定：邀请人与归属商家属于同一组织 */
export async function sameOrganization(
  prisma: PrismaService,
  inviter: Pick<InviteInviter, 'organizationId'>,
  merchantId: string | null,
): Promise<boolean> {
  if (!inviter.organizationId || !merchantId) {
    return false
  }
  const merchant = await prisma.user.findUnique({
    where: { id: merchantId },
    select: { organizationId: true },
  })
  return Boolean(merchant?.organizationId && merchant.organizationId === inviter.organizationId)
}
