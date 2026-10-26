import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  CommissionRateType,
  CommissionStatus,
  Prisma,
} from '@prisma/client'
import { Cron, CronExpression } from '@nestjs/schedule'
import { randomBytes } from 'node:crypto'
import { Role } from '@mall/shared'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCommissionRuleDto } from './dto/create-rule.dto'
import type { AuthUser } from '../auth/auth-user.type'

const SALE_PROTECTION_DAYS = 7

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRule(dto: CreateCommissionRuleDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } })
    if (!product) {
      throw new NotFoundException('商品不存在')
    }
    const effectiveFrom = new Date(dto.effectiveFrom)
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException('生效结束时间必须晚于开始时间')
    }
    if (dto.rateType === 'percentage' && dto.rateBps === undefined) {
      throw new BadRequestException('比例规则需要填写 rateBps')
    }
    if (dto.rateType === 'fixed' && !dto.fixedAmountCents) {
      throw new BadRequestException('固定金额规则需要填写 fixedAmountCents')
    }

    if (dto.rateType === 'percentage') {
      const activeRules = await this.prisma.commissionRule.findMany({
        where: {
          productId: dto.productId,
          effectiveFrom: { lte: effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      })
      const latestByLevel = new Map<number, (typeof activeRules)[number]>()
      for (const rule of activeRules) {
        if (!latestByLevel.has(rule.level)) {
          latestByLevel.set(rule.level, rule)
        }
      }
      let total = dto.rateBps ?? 0
      for (const level of [1, 2]) {
        if (level === dto.level) {
          continue
        }
        const rule = latestByLevel.get(level)
        if (rule?.rateType === 'percentage' && rule.rateBps) {
          total += rule.rateBps
        }
      }
      if (total > product.commissionRateCapBps) {
        throw new BadRequestException(
          `一级与二级佣金比例之和不能超过平台上限 ${product.commissionRateCapBps} bps`,
        )
      }
    }

    return this.prisma.commissionRule.create({
      data: {
        productId: dto.productId,
        level: dto.level,
        rateType: dto.rateType as CommissionRateType,
        rateBps: dto.rateType === 'percentage' ? dto.rateBps : null,
        fixedAmountCents: dto.rateType === 'fixed' ? dto.fixedAmountCents : null,
        effectiveFrom,
        effectiveTo,
      },
    })
  }

  async listRules(productId?: string) {
    return this.prisma.commissionRule.findMany({
      where: productId ? { productId } : undefined,
      orderBy: [{ productId: 'asc' }, { level: 'asc' }, { effectiveFrom: 'desc' }],
    })
  }

  async generateForOrderInTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    generationOverride?: number,
  ) {
    const order = await tx.salesOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    if (!order || !order.paidAt) {
      return { created: 0 }
    }

    const existing = await tx.commission.count({
      where: { orderId, status: { not: CommissionStatus.invalid } },
    })
    if (existing > 0 && generationOverride === undefined) {
      return { created: 0 }
    }

    const channelId = order.attributedChannelId ?? order.preAttributionChannelId
    const channel = channelId
      ? await tx.channelIdentity.findUnique({ where: { id: channelId } })
      : null
    const customer = await tx.user.findUnique({
      where: { id: order.customerId },
      select: { realName: true, idCardNo: true, riskLevel: true },
    })

    const level1 = channel
      ? { beneficiaryId: channel.userId, beneficiaryType: channel.type }
      : null
    let level2: { beneficiaryId: string; beneficiaryType: string } | null = null
    if (channel?.type === 'partner') {
      const invitation = await tx.invitation.findUnique({
        where: { partnerId: channel.userId },
      })
      if (invitation && invitation.status === 'active') {
        level2 = { beneficiaryId: invitation.inviterId, beneficiaryType: 'partner' }
      }
    }

    const generation =
      generationOverride ??
      ((await tx.commission.aggregate({ where: { orderId }, _max: { generation: true } }))._max
        .generation ?? 0) + 1

    let created = 0
    for (const item of order.items) {
      let level1Amount = 0
      let level2Amount = 0

      for (const [level, beneficiary] of [
        [1, level1],
        [2, level2],
      ] as const) {
        if (!beneficiary) {
          continue
        }
        const rule = await tx.commissionRule.findFirst({
          where: {
            productId: item.productId,
            level,
            effectiveFrom: { lte: order.paidAt },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: order.paidAt } }],
          },
          orderBy: { effectiveFrom: 'desc' },
        })
        const baseAmountCents = item.amountCents - item.refundedAmountCents
        const beneficiaryUser = await tx.user.findUnique({
          where: { id: beneficiary.beneficiaryId },
          select: { realName: true, idCardNo: true },
        })
        const selfPurchase = isSamePerson(customer, beneficiaryUser)

        if (!rule) {
          await tx.commission.create({
            data: {
              commissionNo: this.generateCommissionNo(),
              orderId,
              orderItemId: item.id,
              level,
              generation,
              beneficiaryId: beneficiary.beneficiaryId,
              beneficiaryType: beneficiary.beneficiaryType,
              baseAmountCents,
              rateType: CommissionRateType.percentage,
              amountCents: 0,
              ruleVersion: 'missing',
              status: CommissionStatus.disputed,
              selfPurchase,
              note: '佣金规则缺失，待平台裁定',
            },
          })
          await tx.systemAlert.create({
            data: {
              type: 'commission_rule_missing',
              subjectType: 'order',
              subjectId: orderId,
              message: `订单 ${order.orderNo} 缺少商品 ${item.skuCode} 的 ${level} 级佣金规则`,
              severity: 'warning',
            },
          })
          created += 1
          continue
        }

        const amountCents =
          rule.rateType === CommissionRateType.percentage
            ? Math.round((baseAmountCents * (rule.rateBps ?? 0)) / 10000)
            : (rule.fixedAmountCents ?? 0)

        await tx.commission.create({
          data: {
            commissionNo: this.generateCommissionNo(),
            orderId,
            orderItemId: item.id,
            level,
            generation,
            beneficiaryId: beneficiary.beneficiaryId,
            beneficiaryType: beneficiary.beneficiaryType,
            baseAmountCents,
            rateType: rule.rateType,
            rateBps: rule.rateBps,
            fixedAmountCents: rule.fixedAmountCents,
            amountCents,
            ruleId: rule.id,
            ruleVersion: rule.id,
            status: selfPurchase
              ? CommissionStatus.invalid
              : customer?.riskLevel === 'watch'
                ? CommissionStatus.pending_reconciliation
                : CommissionStatus.estimated,
            selfPurchase,
            note: selfPurchase
              ? '自购不返，记录保留但不进入对账单'
              : customer?.riskLevel === 'watch'
                ? '注册风险名单，佣金延迟进入待对账'
                : null,
          },
        })
        if (level === 1) {
          level1Amount += amountCents
        } else {
          level2Amount += amountCents
        }
        created += 1
      }

      const supplyCostCents = item.supplyPriceCents * item.quantity
      const platformServiceFeeCents = Math.round(
        (item.amountCents * item.platformServiceRateBps) / 10000,
      )
      const merchantIncomeCents =
        item.amountCents - supplyCostCents - platformServiceFeeCents - level1Amount - level2Amount
      await tx.orderSettlement.upsert({
        where: { orderItemId: item.id },
        update: {
          supplyCostCents,
          platformServiceFeeCents,
          level1CommissionCents: level1Amount,
          level2CommissionCents: level2Amount,
          merchantIncomeCents,
        },
        create: {
          orderId,
          orderItemId: item.id,
          supplyCostCents,
          platformServiceFeeCents,
          level1CommissionCents: level1Amount,
          level2CommissionCents: level2Amount,
          merchantIncomeCents,
        },
      })
    }

    return { created }
  }

  async recomputeForOrder(orderId: string) {
    const order = await this.prisma.salesOrder.findUnique({ where: { id: orderId } })
    if (!order?.paidAt) {
      return { recomputed: false }
    }
    const channelId = order.attributedChannelId ?? order.preAttributionChannelId
    const channel = channelId
      ? await this.prisma.channelIdentity.findUnique({ where: { id: channelId } })
      : null
    const active = await this.prisma.commission.findMany({
      where: { orderId, status: { not: CommissionStatus.invalid } },
    })
    if (active.length > 0 && channel && active.every((item) => item.beneficiaryId === channel.userId)) {
      return { recomputed: false }
    }
    if (active.length > 0) {
      await this.prisma.commission.updateMany({
        where: { orderId, status: { not: CommissionStatus.invalid } },
        data: { status: CommissionStatus.invalid, note: '归属改定，原佣金作废重算' },
      })
    }
    const maxGeneration = await this.prisma.commission.aggregate({
      where: { orderId },
      _max: { generation: true },
    })
    const generation = (maxGeneration._max.generation ?? 0) + 1
    await this.prisma.$transaction((tx) =>
      this.generateForOrderInTransaction(tx, orderId, generation),
    )
    return { recomputed: true }
  }

  /**
   * 退款后按累计净额口径重算订单项结算（货款/成本/服务费/佣金净额/商家收入）。
   * 返回商家收入的累计应冲回差额（旧值 - 新值），供对账行冲回使用。
   */
  async recomputeSettlementForItemInTransaction(tx: Prisma.TransactionClient, orderItemId: string) {
    const item = await tx.salesOrderItem.findUnique({ where: { id: orderItemId } })
    if (!item) {
      throw new BadRequestException('订单项不存在')
    }
    const commissions = await tx.commission.findMany({ where: { orderItemId } })
    const netAmount = (level: number) =>
      commissions
        .filter((commission) => commission.level === level)
        .reduce((sum, commission) => sum + commission.amountCents - commission.reversedAmountCents, 0)
    const level1Net = netAmount(1)
    const level2Net = netAmount(2)
    const amountEff = item.amountCents - item.refundedAmountCents
    const supplyEff = item.supplyPriceCents * (item.quantity - item.refundedQuantity)
    const feeEff = Math.round((amountEff * item.platformServiceRateBps) / 10000)
    const merchantIncome = amountEff - supplyEff - feeEff - level1Net - level2Net

    const prev = await tx.orderSettlement.findUnique({ where: { orderItemId } })
    if (!prev) {
      return { settlementId: null, currentIncome: 0 }
    }
    await tx.orderSettlement.update({
      where: { orderItemId },
      data: {
        supplyCostCents: supplyEff,
        platformServiceFeeCents: feeEff,
        level1CommissionCents: level1Net,
        level2CommissionCents: level2Net,
        merchantIncomeCents: merchantIncome,
      },
    })
    return { settlementId: prev.id, currentIncome: merchantIncome }
  }

  /**
   * refundedQuantity 为该订单项累计已退数量（含本次），
   * 按累计数量计算目标冲销额，避免多次部分退款时按次舍入产生残留。
   */
  async reverseForRefundInTransaction(
    tx: Prisma.TransactionClient,
    orderItemId: string,
    refundedQuantity: number,
    itemQuantity: number,
  ) {
    const commissions = await tx.commission.findMany({
      where: { orderItemId, status: { not: CommissionStatus.invalid } },
    })
    for (const commission of commissions) {
      const targetReversed = Math.round(
        (commission.amountCents * refundedQuantity) / itemQuantity,
      )
      const reverse = Math.min(
        Math.max(targetReversed - commission.reversedAmountCents, 0),
        commission.amountCents - commission.reversedAmountCents,
      )
      if (reverse <= 0) {
        continue
      }
      const nextReversed = commission.reversedAmountCents + reverse
      await tx.commission.update({
        where: { id: commission.id },
        data: {
          reversedAmountCents: nextReversed,
          status:
            nextReversed >= commission.amountCents
              ? CommissionStatus.invalid
              : commission.status,
        },
      })
    }
  }

  async confirmEligible() {
    const cutoff = new Date(Date.now() - SALE_PROTECTION_DAYS * 24 * 60 * 60 * 1000)
    const orders = await this.prisma.salesOrder.findMany({
      where: {
        status: 'completed',
        completedAt: { not: null, lte: cutoff },
      },
      select: { id: true },
    })
    if (orders.length === 0) {
      return { orders: 0, updated: 0 }
    }
    const result = await this.prisma.commission.updateMany({
      where: {
        orderId: { in: orders.map((order) => order.id) },
        status: CommissionStatus.estimated,
      },
      data: { status: CommissionStatus.pending_reconciliation },
    })
    return { orders: orders.length, updated: result.count }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async confirmEligibleCron(): Promise<void> {
    await this.confirmEligible()
  }

  async list(actor: AuthUser) {
    if (actor.roles.includes(Role.PLATFORM)) {
      return this.prisma.commission.findMany({ orderBy: { createdAt: 'desc' } })
    }
    if (actor.roles.includes(Role.PARTNER)) {
      return this.prisma.commission.findMany({
        where: { beneficiaryId: actor.sub },
        orderBy: { createdAt: 'desc' },
      })
    }
    if (actor.roles.includes(Role.MERCHANT)) {
      const orders = await this.prisma.salesOrder.findMany({
        where: { merchantId: actor.sub },
        select: { id: true },
      })
      return this.prisma.commission.findMany({
        where: { orderId: { in: orders.map((order) => order.id) } },
        orderBy: { createdAt: 'desc' },
      })
    }
    throw new ForbiddenException('无权查看佣金')
  }

  async orderCommissions(orderId: string, actor: AuthUser) {
    await this.assertOrderAccess(orderId, actor)
    return this.prisma.commission.findMany({
      where: { orderId },
      orderBy: [{ orderItemId: 'asc' }, { level: 'asc' }],
    })
  }

  async orderSplit(orderId: string, actor: AuthUser) {
    await this.assertOrderAccess(orderId, actor)
    const settlements = await this.prisma.orderSettlement.findMany({
      where: { orderId },
      orderBy: { orderItemId: 'asc' },
    })
    const commissions = await this.prisma.commission.findMany({ where: { orderId } })
    return { settlements, commissions }
  }

  private async assertOrderAccess(orderId: string, actor: AuthUser) {
    const order = await this.prisma.salesOrder.findUnique({ where: { id: orderId } })
    if (!order) {
      throw new NotFoundException('销售单不存在')
    }
    if (actor.roles.includes(Role.PLATFORM)) {
      return
    }
    if (actor.roles.includes(Role.MERCHANT) && order.merchantId === actor.sub) {
      return
    }
    if (actor.roles.includes(Role.CUSTOMER) && order.customerId === actor.sub) {
      return
    }
    if (actor.roles.includes(Role.PARTNER)) {
      const channelId = order.attributedChannelId ?? order.preAttributionChannelId
      const channel = channelId
        ? await this.prisma.channelIdentity.findFirst({
            where: { id: channelId, userId: actor.sub },
          })
        : null
      if (channel) {
        return
      }
    }
    throw new ForbiddenException('无权查看该订单佣金')
  }

  private generateCommissionNo(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return `CM${date}${randomBytes(3).toString('hex').toUpperCase()}`
  }
}

function isSamePerson(
  customer: { realName: string | null; idCardNo: string | null } | null,
  beneficiary: { realName: string | null; idCardNo: string | null } | null,
): boolean {
  if (!customer || !beneficiary) {
    return false
  }
  if (customer.realName && beneficiary.realName && customer.realName === beneficiary.realName) {
    return true
  }
  return Boolean(
    customer.idCardNo && beneficiary.idCardNo && customer.idCardNo === beneficiary.idCardNo,
  )
}
