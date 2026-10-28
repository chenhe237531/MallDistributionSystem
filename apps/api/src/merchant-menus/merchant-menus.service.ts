import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AccountStatus as PrismaAccountStatus, Role as PrismaRole } from '@prisma/client'
import {
  DEFAULT_MERCHANT_MENUS,
  Role,
  validateMerchantMenus,
} from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { asStringArray } from '../prisma/array-values'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from '../auth/auth-user.type'
import type { MerchantMenuPermission, Organization, User } from '@prisma/client'

type MerchantWithOrg = User & { organization: Organization | null }

export interface MerchantMenusView {
  merchantId: string
  /** 生效菜单 key 列表 */
  menus: string[]
  /** true = 尚未配置过，按默认全量返回 */
  isDefault: boolean
  updatedAt: string | null
  updatedBy: string | null
}

@Injectable()
export class MerchantMenusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** 后台查询某商家的菜单权限（未配置时返回默认全量并标记 isDefault） */
  async getForMerchant(merchantId: string): Promise<MerchantMenusView> {
    const merchant = await this.findMerchant(merchantId)
    const row = await this.prisma.merchantMenuPermission.findUnique({
      where: { merchantId: merchant.id },
    })
    return this.toView(merchant.id, row)
  }

  /** 后台保存（upsert）某商家的菜单权限，并记录审计日志 */
  async save(merchantId: string, menus: unknown, actor: AuthUser): Promise<MerchantMenusView> {
    const merchant = await this.findMerchant(merchantId)
    this.assertSettledMerchant(merchant)

    const validation = validateMerchantMenus(menus)
    if (!validation.ok) {
      throw new BadRequestException(validation.error)
    }

    const before = await this.prisma.merchantMenuPermission.findUnique({
      where: { merchantId: merchant.id },
      select: { menus: true },
    })

    const row = await this.prisma.merchantMenuPermission.upsert({
      where: { merchantId: merchant.id },
      update: { menus: validation.menus, updatedBy: actor.sub },
      create: {
        merchantId: merchant.id,
        menus: validation.menus,
        updatedBy: actor.sub,
      },
    })

    await this.auditService.record({
      actor,
      action: 'merchant_menu.updated',
      resourceType: 'merchant_menu',
      resourceId: merchant.id,
      merchantId: merchant.id,
      detail: {
        before: before?.menus ?? null,
        after: validation.menus,
      },
    })

    return this.toView(merchant.id, row)
  }

  /**
   * 商家端登录用户查询自己的生效菜单：
   * - 商家主账号：本人配置，未配置则默认全量
   * - 销售：沿用同组织商家主账号的配置（商家数据关联），无则默认全量
   * - 其他角色：拒绝
   */
  async resolveForUser(authUser: AuthUser): Promise<{ menus: string[] }> {
    if (
      authUser.role !== Role.MERCHANT &&
      authUser.role !== Role.SALES &&
      !authUser.roles.includes(Role.MERCHANT) &&
      !authUser.roles.includes(Role.SALES)
    ) {
      throw new ForbiddenException('当前角色无权查询商家菜单权限')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
      include: { organization: true },
    })
    if (!user) {
      throw new NotFoundException('账号不存在')
    }

    let row: MerchantMenuPermission | null = null
    if (user.primaryRole === PrismaRole.merchant) {
      row = await this.prisma.merchantMenuPermission.findUnique({
        where: { merchantId: user.id },
      })
    } else if (user.organizationId) {
      // 销售：继承同组织商家主账号的菜单配置
      const owner = await this.prisma.user.findFirst({
        where: {
          organizationId: user.organizationId,
          primaryRole: PrismaRole.merchant,
        },
        select: { id: true },
      })
      if (owner) {
        row = await this.prisma.merchantMenuPermission.findUnique({
          where: { merchantId: owner.id },
        })
      }
    }

    return { menus: row ? asStringArray(row.menus) : [...DEFAULT_MERCHANT_MENUS] }
  }

  /** 目标账号必须存在且主角色为商家（查询/保存共用） */
  private async findMerchant(merchantId: string): Promise<MerchantWithOrg> {
    const merchant = await this.prisma.user.findUnique({
      where: { id: merchantId },
      include: { organization: true },
    })
    if (!merchant) {
      throw new NotFoundException('账号不存在')
    }
    if (merchant.primaryRole !== PrismaRole.merchant) {
      throw new BadRequestException('仅支持为商家主账号配置菜单权限')
    }
    return merchant
  }

  /** 已入驻校验：账号启用且挂靠组织启用（未入驻/已停用商家不可配置） */
  private assertSettledMerchant(merchant: MerchantWithOrg): void {
    if (merchant.status !== PrismaAccountStatus.active) {
      throw new BadRequestException('仅支持为已启用（已入驻）的商家配置菜单权限')
    }
    if (merchant.organization && merchant.organization.status !== PrismaAccountStatus.active) {
      throw new BadRequestException('商家所属组织未启用，无法配置菜单权限')
    }
  }

  private toView(
    merchantId: string,
    row: MerchantMenuPermission | null,
  ): MerchantMenusView {
    if (!row) {
      return {
        merchantId,
        menus: [...DEFAULT_MERCHANT_MENUS],
        isDefault: true,
        updatedAt: null,
        updatedBy: null,
      }
    }
    return {
      merchantId,
      menus: asStringArray(row.menus),
      isDefault: false,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    }
  }
}
