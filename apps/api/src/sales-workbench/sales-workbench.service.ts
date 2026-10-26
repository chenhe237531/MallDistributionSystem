import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ClaimStatus as PrismaClaimStatus } from '@prisma/client'
import { Role } from '@mall/shared'
import { asRoleArray } from '../prisma/array-values'
import { PrismaService } from '../prisma/prisma.service'
import { AssignSalesDto, CreateClaimDto } from './dto/workbench.dto'
import type { AuthUser } from '../auth/auth-user.type'

@Injectable()
export class SalesWorkbenchService {
  constructor(private readonly prisma: PrismaService) {}

  async customersForSales(salesId: string) {
    const ownerships = await this.prisma.customerOwnership.findMany({
      where: { salesId },
      include: { customer: { select: { id: true, name: true, phone: true } } },
    })
    return this.toCustomerViews(ownerships)
  }

  async merchantCustomers(merchantId: string) {
    const ownerships = await this.prisma.customerOwnership.findMany({
      where: { merchantId },
      include: { customer: { select: { id: true, name: true, phone: true } } },
    })
    const salesIds = [...new Set(ownerships.map((item) => item.salesId).filter(Boolean))] as string[]
    const salesUsers = await this.prisma.user.findMany({
      where: { id: { in: salesIds } },
      select: { id: true, name: true },
    })
    const salesNameById = new Map(salesUsers.map((user) => [user.id, user.name]))
    const views = await this.toCustomerViews(ownerships)
    return views.map((view, index) => ({
      ...view,
      salesName: ownerships[index].salesId
        ? salesNameById.get(ownerships[index].salesId as string) ?? null
        : null,
    }))
  }

  async performance(salesId: string, from?: string, to?: string) {
    const ownerships = await this.prisma.customerOwnership.findMany({
      where: { salesId },
      select: { customerId: true },
    })
    const customerIds = ownerships.map((item) => item.customerId)
    if (customerIds.length === 0) {
      return {
        customerCount: 0,
        orderCount: 0,
        totalAmountCents: 0,
        avgOrderCents: null,
      }
    }
    const paidAtFilter: { gte?: Date; lte?: Date } = {}
    if (from) {
      paidAtFilter.gte = new Date(from)
    }
    if (to) {
      paidAtFilter.lte = new Date(to)
    }
    const orders = await this.prisma.salesOrder.aggregate({
      where: {
        customerId: { in: customerIds },
        paidAt: { not: null, ...paidAtFilter },
      },
      _count: { _all: true },
      _sum: { totalAmountCents: true },
    })
    const orderCount = orders._count._all
    const totalAmountCents = orders._sum.totalAmountCents ?? 0
    return {
      customerCount: customerIds.length,
      orderCount,
      totalAmountCents,
      avgOrderCents: orderCount > 0 ? Math.round(totalAmountCents / orderCount) : null,
    }
  }

  async createClaim(actor: AuthUser, dto: CreateClaimDto) {
    if (!actor.roles.includes(Role.SALES)) {
      throw new ForbiddenException('只有销售可以申请认领客户')
    }
    const sales = await this.prisma.user.findUnique({ where: { id: actor.sub } })
    if (!sales?.organizationId) {
      throw new BadRequestException('销售未绑定商家组织')
    }
    const merchants = await this.prisma.user.findMany({
      where: { organizationId: sales.organizationId },
    })
    const merchant = merchants.find((user) => asRoleArray(user.roles).includes(Role.MERCHANT))
    if (!merchant) {
      throw new BadRequestException('未找到所属商家')
    }
    const customer = await this.prisma.user.findUnique({ where: { phone: dto.customerPhone } })
    if (!customer || !asRoleArray(customer.roles).includes(Role.CUSTOMER)) {
      throw new NotFoundException('客户不存在')
    }
    const ownership = await this.prisma.customerOwnership.findUnique({
      where: { customerId: customer.id },
    })
    if (!ownership) {
      throw new BadRequestException('该客户尚未激活盒码，暂无归属')
    }
    if (ownership.merchantId !== merchant.id) {
      throw new ForbiddenException('该客户不属于本商家，无法认领')
    }
    if (ownership.salesId === actor.sub) {
      throw new ConflictException('该客户已在你的名下')
    }
    const existing = await this.prisma.salesCustomerClaim.findFirst({
      where: { salesId: actor.sub, customerId: customer.id, status: PrismaClaimStatus.pending },
    })
    if (existing) {
      throw new ConflictException('已提交认领申请，等待客户确认')
    }
    const claim = await this.prisma.salesCustomerClaim.create({
      data: {
        salesId: actor.sub,
        merchantId: merchant.id,
        customerId: customer.id,
      },
    })
    return {
      ...claim,
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
    }
  }

  async listClaims(actor: AuthUser) {
    let claims
    if (actor.roles.includes(Role.PLATFORM)) {
      claims = await this.prisma.salesCustomerClaim.findMany({
        orderBy: { createdAt: 'desc' },
      })
    } else if (actor.roles.includes(Role.SALES)) {
      claims = await this.prisma.salesCustomerClaim.findMany({
        where: { salesId: actor.sub },
        orderBy: { createdAt: 'desc' },
      })
    } else if (actor.roles.includes(Role.MERCHANT)) {
      claims = await this.prisma.salesCustomerClaim.findMany({
        where: { merchantId: actor.sub },
        orderBy: { createdAt: 'desc' },
      })
    } else {
      throw new ForbiddenException('无权查看认领申请')
    }

    const customers = await this.prisma.user.findMany({
      where: { id: { in: claims.map((claim) => claim.customerId) } },
      select: { id: true, name: true, phone: true },
    })
    const customerById = new Map(customers.map((customer) => [customer.id, customer]))
    return claims.map((claim) => ({
      ...claim,
      customer: customerById.get(claim.customerId) ?? null,
    }))
  }

  async resolveClaim(id: string, actor: AuthUser, confirm: boolean) {
    const claim = await this.prisma.salesCustomerClaim.findUnique({ where: { id } })
    if (!claim) {
      throw new NotFoundException('认领申请不存在')
    }
    if (claim.status !== PrismaClaimStatus.pending) {
      throw new BadRequestException('该申请已处理')
    }
    const canResolve =
      actor.roles.includes(Role.PLATFORM) ||
      (actor.roles.includes(Role.CUSTOMER) && claim.customerId === actor.sub) ||
      (actor.roles.includes(Role.MERCHANT) &&
        (await this.isMerchantOf(actor.sub, claim.merchantId)))
    if (!canResolve) {
      throw new ForbiddenException('无权处理该申请')
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.salesCustomerClaim.update({
        where: { id },
        data: {
          status: confirm ? PrismaClaimStatus.confirmed : PrismaClaimStatus.rejected,
          resolvedAt: new Date(),
          resolvedBy: actor.sub,
        },
      })
      if (confirm) {
        await tx.customerOwnership.update({
          where: { customerId: claim.customerId },
          data: { salesId: claim.salesId },
        })
        await tx.salesOrder.updateMany({
          where: { customerId: claim.customerId, merchantId: claim.merchantId },
          data: { attributedSalesId: claim.salesId },
        })
      }
      return updated
    })
  }

  async assignSales(merchantId: string, customerId: string, dto: AssignSalesDto) {
    const merchant = await this.prisma.user.findUnique({ where: { id: merchantId } })
    if (!merchant?.organizationId) {
      throw new NotFoundException('商家不存在')
    }
    const sales = await this.prisma.user.findUnique({ where: { id: dto.salesId } })
    if (
      !sales ||
      !asRoleArray(sales.roles).includes(Role.SALES) ||
      sales.organizationId !== merchant.organizationId
    ) {
      throw new BadRequestException('销售不属于该商家')
    }
    const ownership = await this.prisma.customerOwnership.findUnique({ where: { customerId } })
    if (!ownership || ownership.merchantId !== merchantId) {
      throw new NotFoundException('客户不属于该商家')
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customerOwnership.update({
        where: { customerId },
        data: { salesId: dto.salesId },
      })
      await tx.salesOrder.updateMany({
        where: { customerId, merchantId },
        data: { attributedSalesId: dto.salesId },
      })
      return updated
    })
  }

  private async toCustomerViews(
    ownerships: Array<{
      customerId: string
      customer: { id: string; name: string; phone: string }
      ownedAt: Date
      sourceBoxCode: string
    }>,
  ) {
    const customerIds = ownerships.map((item) => item.customerId)
    if (customerIds.length === 0) {
      return []
    }
    const grouped = await this.prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds }, paidAt: { not: null } },
      _count: { _all: true },
      _sum: { totalAmountCents: true },
      _max: { paidAt: true },
    })
    const groupedByCustomer = new Map(grouped.map((item) => [item.customerId, item]))
    const reports = await this.prisma.report.findMany({
      where: { customerId: { in: customerIds } },
      orderBy: { createdAt: 'desc' },
      select: { customerId: true, status: true, reportNo: true },
    })
    const latestReportByCustomer = new Map<
      string,
      { status: string; reportNo: string }
    >()
    for (const report of reports) {
      if (!latestReportByCustomer.has(report.customerId)) {
        latestReportByCustomer.set(report.customerId, {
          status: report.status,
          reportNo: report.reportNo,
        })
      }
    }

    return ownerships.map((ownership) => {
      const group = groupedByCustomer.get(ownership.customerId)
      const orderCount = group?._count._all ?? 0
      const totalAmountCents = group?._sum.totalAmountCents ?? 0
      return {
        customerId: ownership.customerId,
        name: ownership.customer.name,
        phone: ownership.customer.phone,
        ownedAt: ownership.ownedAt,
        sourceBoxCode: ownership.sourceBoxCode,
        orderCount,
        totalAmountCents,
        avgOrderCents: orderCount > 0 ? Math.round(totalAmountCents / orderCount) : null,
        lastOrderAt: group?._max.paidAt ?? null,
        reportStatus: latestReportByCustomer.get(ownership.customerId)?.status ?? null,
      }
    })
  }

  private async isMerchantOf(actorId: string, merchantId: string): Promise<boolean> {
    if (actorId === merchantId) {
      return true
    }
    const actor = await this.prisma.user.findUnique({ where: { id: actorId } })
    const merchant = await this.prisma.user.findUnique({ where: { id: merchantId } })
    return Boolean(
      actor?.organizationId &&
        merchant?.organizationId &&
        actor.organizationId === merchant.organizationId,
    )
  }
}
