import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  AccountStatus as PrismaAccountStatus,
  ChannelIdentity,
  ChannelType as PrismaChannelType,
  Organization,
  Qualification,
  Role as PrismaRole,
  User,
} from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { Role } from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import { AddQualificationDto } from './dto/add-qualification.dto'
import { CreateAccountDto } from './dto/create-account.dto'
import { CreateSalesDto } from './dto/create-sales.dto'
import { ReviewQualificationDto } from './dto/review-qualification.dto'
import type { AuthUser } from '../auth/auth-user.type'

const ORGANIZATION_ROLES: PrismaRole[] = ['supplier', 'lab', 'merchant']
const EXPIRY_WINDOW_DAYS = 30

type AccountWithRelations = User & {
  organization: Organization | null
  channels: ChannelIdentity[]
  qualifications: Qualification[]
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateAccountDto) {
    const primaryRole = dto.primaryRole as unknown as PrismaRole
    if (primaryRole === 'customer' || primaryRole === 'sales') {
      throw new BadRequestException('销售账号由商家创建，C 端账号由用户自助注册')
    }

    const roles = Array.from(new Set<PrismaRole>([primaryRole, ...((dto.roles ?? []) as unknown as PrismaRole[])]))
    if (roles.includes('customer') || roles.includes('sales')) {
      throw new BadRequestException('账号角色不能包含 customer 或 sales')
    }

    const orgRoles = roles.filter((role) => ORGANIZATION_ROLES.includes(role))
    if (new Set(orgRoles).size > 1) {
      throw new BadRequestException('同一账号不能同时属于多个组织类型')
    }

    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } })
    if (existing) {
      throw new ConflictException('该手机号已注册')
    }

    const organizationType = orgRoles[0]
    if (organizationType && !dto.organizationName) {
      throw new BadRequestException('该角色需要填写组织名称')
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const organization = organizationType
        ? await tx.organization.create({
            data: {
              name: dto.organizationName as string,
              type: organizationType,
              status: PrismaAccountStatus.pending,
            },
          })
        : null

      return tx.user.create({
        data: {
          phone: dto.phone,
          passwordHash: await bcrypt.hash(dto.password, 10),
          name: dto.name,
          roles,
          primaryRole,
          status: primaryRole === 'platform' ? PrismaAccountStatus.active : PrismaAccountStatus.pending,
          organizationId: organization?.id,
        },
      })
    })

    return this.getOne(user.id)
  }

  async list(status?: string) {
    const users = await this.prisma.user.findMany({
      where: status ? { status: status as PrismaAccountStatus } : undefined,
      include: { organization: true, channels: true, qualifications: true },
      orderBy: { createdAt: 'desc' },
    })
    return users.map((user) => this.toView(user))
  }

  async getOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { organization: true, channels: true, qualifications: true },
    })
    if (!user) {
      throw new NotFoundException('账号不存在')
    }
    return this.toView(user)
  }

  async approve(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { channels: true },
    })
    if (!user) {
      throw new NotFoundException('账号不存在')
    }
    if (user.status === PrismaAccountStatus.rejected) {
      throw new BadRequestException('已拒绝的账号不能直接通过，请重新提交')
    }

    const roles = user.roles as unknown as Role[]
    const pendingChannels: Array<{ type: PrismaChannelType; code: string }> = []

    if (roles.includes(Role.MERCHANT) && !user.channels.some((channel) => channel.type === PrismaChannelType.merchant)) {
      pendingChannels.push({ type: PrismaChannelType.merchant, code: await this.generateChannelCode(PrismaChannelType.merchant) })
    }
    if (roles.includes(Role.PARTNER) && !user.channels.some((channel) => channel.type === PrismaChannelType.partner)) {
      pendingChannels.push({ type: PrismaChannelType.partner, code: await this.generateChannelCode(PrismaChannelType.partner) })
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status: PrismaAccountStatus.active },
      })
      if (user.organizationId) {
        await tx.organization.update({
          where: { id: user.organizationId },
          data: { status: PrismaAccountStatus.active },
        })
      }
      // 停用账号重新审批通过时，同步恢复其既有渠道（否则渠道仍为 inactive，
      // 商家无法生成盒码），与 suspend() 的渠道停用逻辑对称
      await tx.channelIdentity.updateMany({
        where: { userId: id, status: 'inactive' },
        data: { status: 'active' },
      })
      for (const channel of pendingChannels) {
        await tx.channelIdentity.create({
          data: { type: channel.type, code: channel.code, userId: id },
        })
      }
      if (roles.includes(Role.MERCHANT)) {
        await tx.prepaidAccount.upsert({
          where: { merchantId: id },
          update: {},
          create: { merchantId: id },
        })
      }
      const trainingRoles = roles.filter((role) =>
        [Role.SALES, Role.PARTNER, Role.NUTRITIONIST].includes(role),
      )
      if (trainingRoles.length > 0) {
        const courses = await tx.course.findMany({
          where: { audience: { hasSome: trainingRoles as unknown as PrismaRole[] } },
        })
        for (const course of courses) {
          await tx.learningRecord.upsert({
            where: { userId_courseId: { userId: id, courseId: course.id } },
            update: {},
            create: { userId: id, courseId: course.id },
          })
        }
      }
    })

    return this.getOne(id)
  }

  async reject(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) {
      throw new NotFoundException('账号不存在')
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: PrismaAccountStatus.rejected } })
      if (user.organizationId) {
        await tx.organization.update({
          where: { id: user.organizationId },
          data: { status: PrismaAccountStatus.rejected },
        })
      }
    })
    return this.getOne(id)
  }

  async suspend(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) {
      throw new NotFoundException('账号不存在')
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: PrismaAccountStatus.suspended } })
      await tx.channelIdentity.updateMany({ where: { userId: id }, data: { status: 'inactive' } })
      if (user.organizationId) {
        await tx.organization.update({
          where: { id: user.organizationId },
          data: { status: PrismaAccountStatus.suspended },
        })
      }
    })
    return this.getOne(id)
  }

  async createSales(actor: AuthUser, dto: CreateSalesDto) {
    const merchant = await this.prisma.user.findUnique({ where: { id: actor.sub } })
    if (!merchant?.roles.includes(PrismaRole.merchant)) {
      throw new ForbiddenException('只有商家可以创建销售')
    }
    if (!merchant.organizationId) {
      throw new BadRequestException('商家未绑定组织，无法创建销售')
    }
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } })
    if (existing) {
      throw new ConflictException('该手机号已注册')
    }

    const sales = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: dto.name,
        roles: ['sales'],
        primaryRole: 'sales',
        status: PrismaAccountStatus.active,
        organizationId: merchant.organizationId,
      },
    })
    const courses = await this.prisma.course.findMany({
      where: { audience: { has: PrismaRole.sales } },
    })
    for (const course of courses) {
      await this.prisma.learningRecord.upsert({
        where: { userId_courseId: { userId: sales.id, courseId: course.id } },
        update: {},
        create: { userId: sales.id, courseId: course.id },
      })
    }
    return this.getOne(sales.id)
  }

  async addQualification(targetUserId: string, dto: AddQualificationDto) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } })
    if (!user) {
      throw new NotFoundException('账号不存在')
    }
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null
    const qualification = await this.prisma.qualification.create({
      data: {
        userId: targetUserId,
        type: dto.type,
        fileUrl: dto.fileUrl,
        expiresAt,
      },
    })

    if (expiresAt && expiresAt.getTime() - Date.now() <= EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      await this.createExpiryReminder(qualification)
    }
    return qualification
  }

  async listQualifications(targetUserId: string) {
    return this.prisma.qualification.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async reviewQualification(
    targetUserId: string,
    qualificationId: string,
    dto: ReviewQualificationDto,
    reviewerId: string,
  ) {
    const qualification = await this.prisma.qualification.findFirst({
      where: { id: qualificationId, userId: targetUserId },
    })
    if (!qualification) {
      throw new NotFoundException('资质记录不存在')
    }
    return this.prisma.qualification.update({
      where: { id: qualificationId },
      data: {
        status: dto.status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    })
  }

  async bindInviter(partnerId: string, inviterId: string) {
    if (partnerId === inviterId) {
      throw new BadRequestException('不能邀请自己')
    }
    const partner = await this.prisma.user.findUnique({ where: { id: partnerId } })
    if (!partner || !partner.roles.includes(PrismaRole.partner)) {
      throw new BadRequestException('下级主体不是合伙人')
    }
    if (partner.status !== PrismaAccountStatus.active) {
      throw new BadRequestException('下级合伙人账号未启用')
    }
    const inviter = await this.prisma.user.findUnique({ where: { id: inviterId } })
    if (!inviter || !inviter.roles.includes(PrismaRole.partner)) {
      throw new BadRequestException('上级主体不是合伙人')
    }
    if (inviter.status !== PrismaAccountStatus.active) {
      throw new BadRequestException('上级合伙人账号未启用')
    }

    const inviterInvitation = await this.prisma.invitation.findUnique({ where: { partnerId: inviterId } })
    if (inviterInvitation) {
      throw new BadRequestException('上级已有邀请人，系统最多支持两级分销')
    }

    const existing = await this.prisma.invitation.findUnique({ where: { partnerId } })
    if (existing?.inviterId === inviterId) {
      return existing
    }
    if (existing && existing.inviterId !== inviterId) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const changesToday = await this.prisma.auditLog.count({
        where: {
          action: 'partner.bind_inviter',
          resourceId: partnerId,
          createdAt: { gte: today },
        },
      })
      if (changesToday >= 1) {
        await this.prisma.systemAlert.create({
          data: {
            type: 'hierarchy_rebind_frequent',
            subjectType: 'partner',
            subjectId: partnerId,
            message: `合伙人 ${partner.name}（${partner.phone}）一日内频繁改绑上级，已阻断`,
            severity: 'warning',
          },
        })
        throw new BadRequestException('同一合伙人一日内只能改绑一次上级，请次日或线下审批')
      }
    }

    const downline = await this.prisma.invitation.findFirst({ where: { inviterId: partnerId } })
    if (downline) {
      throw new BadRequestException('该合伙人已有下级，不能再绑定上级')
    }

    const cycle = await this.prisma.invitation.findFirst({
      where: { partnerId: inviterId, inviterId: partnerId },
    })
    if (cycle) {
      throw new BadRequestException('不能形成循环邀请')
    }

    const invitation = await this.prisma.invitation.upsert({
      where: { partnerId },
      update: { inviterId },
      create: { partnerId, inviterId },
    })
    await this.auditService.record({
      action: 'partner.bind_inviter',
      resourceType: 'partner',
      resourceId: partnerId,
      detail: {
        inviterId,
        previousInviterId: existing?.inviterId ?? null,
      },
    })
    return invitation
  }

  private async createExpiryReminder(qualification: Qualification) {
    if (!qualification.expiresAt) {
      return
    }
    await this.prisma.reminder.upsert({
      where: {
        type_subjectId_dueAt: {
          type: 'qualification_expiry',
          subjectId: qualification.userId,
          dueAt: qualification.expiresAt,
        },
      },
      update: { qualificationId: qualification.id },
      create: {
        type: 'qualification_expiry',
        subjectId: qualification.userId,
        dueAt: qualification.expiresAt,
        qualificationId: qualification.id,
      },
    })
  }

  private async generateChannelCode(type: PrismaChannelType): Promise<string> {
    const prefix = type === PrismaChannelType.merchant ? 'M' : type === PrismaChannelType.partner ? 'P' : 'S'
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = `${prefix}${randomBytes(6).toString('base64url').replace(/[-_]/g, '').slice(0, 8).toUpperCase()}`
      const existing = await this.prisma.channelIdentity.findUnique({ where: { code } })
      if (!existing) {
        return code
      }
    }
    throw new BadRequestException('渠道码生成失败，请重试')
  }

  private toView(user: AccountWithRelations) {
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      roles: user.roles,
      primaryRole: user.primaryRole,
      status: user.status,
      organizationId: user.organizationId,
      organization: user.organization,
      channels: user.channels,
      qualifications: user.qualifications,
      realName: user.realName,
      idCardNo: user.idCardNo,
      gender: user.gender,
      birthDate: user.birthDate,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }
}
