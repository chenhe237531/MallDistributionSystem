import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ReportAuthorizationDto } from '../samples/dto/activation.dto'
import {
  inviterOrganizationName,
  isSalesInviter,
  resolveInviteInviter,
  sameOrganization,
} from '../common/invite-code'
import { BindInviteCodeDto } from './dto/invite-code.dto'
import { RealNameDto } from './dto/real-name.dto'
import {
  CreateShippingAddressDto,
  UpdateShippingAddressDto,
} from './dto/address.dto'

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async setRealName(userId: string, dto: RealNameDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException('账号不存在')
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        realName: dto.realName,
        idCardNo: dto.idCardNo.toUpperCase(),
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        realName: true,
        idCardNo: true,
        gender: true,
        birthDate: true,
      },
    })
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        channels: true,
        invitedBy: {
          include: { organization: true },
        },
      },
    })
    if (!user) {
      throw new NotFoundException('账号不存在')
    }
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      realName: user.realName,
      idCardNo: user.idCardNo,
      gender: user.gender,
      birthDate: user.birthDate,
      channels: user.channels,
      inviteBinding: user.invitedBy
        ? {
            name: user.invitedBy.name,
            phone: user.invitedBy.phone,
            role: user.invitedBy.primaryRole,
            organizationName: user.invitedBy.organization?.name ?? null,
          }
        : null,
    }
  }

  /**
   * C 端用户绑定商家邀请码：扫码或手动输入。
   * 已有检测盒归属时要求邀请人与归属商家同组织；归属销售直接落到邀请人名下。
   */
  async bindInviteCode(customerId: string, dto: BindInviteCodeDto) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      include: { invitedBy: { select: { id: true } } },
    })
    if (!customer) {
      throw new NotFoundException('账号不存在')
    }
    const inviter = await resolveInviteInviter(this.prisma, dto.code)

    const ownership = await this.prisma.customerOwnership.findUnique({
      where: { customerId },
    })
    if (ownership && !(await sameOrganization(this.prisma, inviter, ownership.merchantId))) {
      throw new ForbiddenException('该邀请码与您的检测盒归属商家不一致，无法绑定')
    }

    // 提前取值：闭包内 ownership.merchantId 的收窄会丢失，导致 string | null 进 where
    const ownershipMerchantId = ownership?.merchantId ?? null
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: customerId },
        data: { invitedByUserId: inviter.id },
      })
      if (ownershipMerchantId && isSalesInviter(inviter)) {
        await tx.customerOwnership.update({
          where: { customerId },
          data: { salesId: inviter.id },
        })
        await tx.salesOrder.updateMany({
          where: { customerId, merchantId: ownershipMerchantId },
          data: { attributedSalesId: inviter.id },
        })
      }
    })

    return {
      bound: true,
      name: inviter.name,
      role: inviter.primaryRole,
      organizationName: await inviterOrganizationName(this.prisma, inviter),
      salesBound: ownership ? isSalesInviter(inviter) : false,
    }
  }

  async getOwnership(customerId: string) {
    const ownership = await this.prisma.customerOwnership.findUnique({
      where: { customerId },
    })
    const consent = await this.prisma.consentRecord.findFirst({
      where: { customerId },
      orderBy: { agreedAt: 'desc' },
    })
    const samples = await this.prisma.sample.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: { boxCode: true },
    })
    return { ownership, consent, samples }
  }

  async setReportAuthorization(customerId: string, dto: ReportAuthorizationDto) {
    const consent = await this.prisma.consentRecord.findFirst({
      where: { customerId },
      orderBy: { agreedAt: 'desc' },
    })
    if (!consent) {
      throw new NotFoundException('尚未签署知情同意书')
    }
    return this.prisma.consentRecord.update({
      where: { id: consent.id },
      data: { reportAuthorization: dto.authorized },
    })
  }

  /** 收货地址列表：默认地址置顶，其余按创建时间倒序 */
  listAddresses(customerId: string) {
    return this.prisma.shippingAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
  }

  async createAddress(customerId: string, dto: CreateShippingAddressDto) {
    const existing = await this.prisma.shippingAddress.count({ where: { customerId } })
    if (existing >= 20) {
      throw new BadRequestException('最多保存 20 个收货地址')
    }
    return this.prisma.$transaction(async (tx) => {
      // 首个地址自动设为默认；显式设默认时清掉旧默认
      const makeDefault = dto.isDefault || existing === 0
      if (makeDefault) {
        await tx.shippingAddress.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        })
      }
      return tx.shippingAddress.create({
        data: {
          customerId,
          receiverName: dto.receiverName.trim(),
          receiverPhone: dto.receiverPhone,
          region: dto.region?.trim() ?? '',
          detail: dto.detail.trim(),
          isDefault: makeDefault,
        },
      })
    })
  }

  async updateAddress(customerId: string, addressId: string, dto: UpdateShippingAddressDto) {
    const target = await this.prisma.shippingAddress.findFirst({
      where: { id: addressId, customerId },
    })
    if (!target) {
      throw new NotFoundException('收货地址不存在')
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault && !target.isDefault) {
        await tx.shippingAddress.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        })
      }
      return tx.shippingAddress.update({
        where: { id: addressId },
        data: {
          receiverName: dto.receiverName.trim(),
          receiverPhone: dto.receiverPhone,
          region: dto.region?.trim() ?? '',
          detail: dto.detail.trim(),
          isDefault: dto.isDefault ?? target.isDefault,
        },
      })
    })
  }

  async deleteAddress(customerId: string, addressId: string) {
    const target = await this.prisma.shippingAddress.findFirst({
      where: { id: addressId, customerId },
    })
    if (!target) {
      throw new NotFoundException('收货地址不存在')
    }
    await this.prisma.shippingAddress.delete({ where: { id: addressId } })
    // 删除的是默认地址时，把最近创建的一条提升为默认，保证下单自动带入可用
    if (target.isDefault) {
      const next = await this.prisma.shippingAddress.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      })
      if (next) {
        await this.prisma.shippingAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        })
      }
    }
    return { ok: true }
  }
}
