import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import {
  Prisma,
  PrepaidAccount,
  PrepaidAccountStatus,
  PrepaidEntryType,
  RechargeStatus,
} from '@prisma/client'
import { formatCents, Role } from '@mall/shared'
import { NotificationsService } from '../notifications/notifications.service'
import { PrismaService } from '../prisma/prisma.service'
import {
  AdjustPrepaidDto,
  CreateRechargeDto,
  CreditRechargeDto,
  LockPrepaidDto,
  RejectRechargeDto,
} from './dto/prepaid.dto'

@Injectable()
export class PrepaidService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getOrCreateAccount(merchantId: string): Promise<PrepaidAccount> {
    const user = await this.prisma.user.findUnique({ where: { id: merchantId } })
    if (!user) {
      throw new NotFoundException('商家账号不存在')
    }
    return this.prisma.prepaidAccount.upsert({
      where: { merchantId },
      update: {},
      create: { merchantId },
    })
  }

  async me(merchantId: string) {
    const account = await this.getOrCreateAccount(merchantId)
    const integrity = await this.verifyIntegrity(account)
    const latest = await this.prisma.prepaidAccount.findUnique({ where: { id: account.id } })
    const entries = await this.prisma.prepaidLedger.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const recharges = await this.prisma.rechargeOrder.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return { account: latest, integrity, entries, recharges }
  }

  async entries(merchantId: string) {
    const account = await this.getOrCreateAccount(merchantId)
    return this.prisma.prepaidLedger.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  async createRecharge(merchantId: string, dto: CreateRechargeDto) {
    await this.getOrCreateAccount(merchantId)
    const merchant = await this.prisma.user.findUnique({
      where: { id: merchantId },
      include: { organization: true },
    })
    if (!merchant) {
      throw new NotFoundException('商家账号不存在')
    }

    if (dto.voucherUrl) {
      const duplicate = await this.prisma.rechargeOrder.findUnique({
        where: { voucherUrl: dto.voucherUrl },
      })
      if (duplicate) {
        throw new ConflictException('该打款凭证已登记，不能重复入账')
      }
    }

    const notes: string[] = []
    if (dto.payerName) {
      const allowedNames = [merchant.name, merchant.organization?.name].filter(Boolean)
      if (!allowedNames.includes(dto.payerName)) {
        notes.push('付款方名称与商家主体不一致，需人工核验')
      }
    }
    if (dto.paidAmountCents !== undefined && dto.paidAmountCents !== dto.amountCents) {
      notes.push('打款金额与登记金额不一致，需人工核验')
    }

    return this.prisma.rechargeOrder.create({
      data: {
        rechargeNo: this.generateRechargeNo(),
        merchantId,
        amountCents: dto.amountCents,
        paidAmountCents: dto.paidAmountCents,
        voucherUrl: dto.voucherUrl,
        payerName: dto.payerName,
        status: notes.length ? RechargeStatus.pending_review : RechargeStatus.pending,
        note: notes.length ? notes.join('；') : null,
      },
    })
  }

  async listRecharges(merchantId?: string) {
    return this.prisma.rechargeOrder.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        merchant: { select: { id: true, name: true, phone: true, organization: true } },
      },
    })
  }

  async credit(rechargeId: string, dto: CreditRechargeDto, operatorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.rechargeOrder.findUnique({ where: { id: rechargeId } })
      if (!order) {
        throw new NotFoundException('充值单不存在')
      }
      if (order.status === RechargeStatus.credited) {
        throw new ConflictException('该充值单已入账')
      }
      if (order.status === RechargeStatus.rejected) {
        throw new BadRequestException('该充值单已拒绝')
      }
      if (order.status === RechargeStatus.pending_review && !dto.reviewApproved) {
        throw new BadRequestException('该充值单需人工核验通过后才能入账')
      }

      const account = await tx.prepaidAccount.upsert({
        where: { merchantId: order.merchantId },
        update: {},
        create: { merchantId: order.merchantId },
      })
      const updatedAccount = await tx.prepaidAccount.update({
        where: { id: account.id },
        data: {
          availableCents: { increment: order.amountCents },
          totalRechargeCents: { increment: order.amountCents },
        },
      })
      await tx.prepaidLedger.create({
        data: {
          accountId: account.id,
          type: PrepaidEntryType.recharge,
          amountCents: order.amountCents,
          balanceAfterCents: updatedAccount.availableCents,
          frozenAfterCents: updatedAccount.frozenCents,
          relatedType: 'recharge_order',
          relatedId: order.id,
          operatorId,
          note: `充值单 ${order.rechargeNo} 入账`,
        },
      })
      const updatedOrder = await tx.rechargeOrder.update({
        where: { id: order.id },
        data: {
          status: RechargeStatus.credited,
          registeredBy: operatorId,
          creditedAt: new Date(),
        },
      })
      return { order: updatedOrder, account: updatedAccount }
    })
    await this.notificationsService.emit({
      type: 'recharge_credited',
      recipientId: result.order.merchantId,
      recipientRole: Role.MERCHANT,
      subjectType: 'recharge_order',
      subjectId: result.order.id,
      title: '充值已入账',
      body: `充值单 ${result.order.rechargeNo} 已入账 ${formatCents(result.order.amountCents)} 元，当前可用余额 ${formatCents(result.account.availableCents)} 元。`,
      templateCode: 'recharge_credited',
      dedupeKey: `recharge_credited:${result.order.id}`,
      payload: { rechargeId: result.order.id, rechargeNo: result.order.rechargeNo },
    })
    return result
  }

  async reject(rechargeId: string, dto: RejectRechargeDto, operatorId: string) {
    const order = await this.prisma.rechargeOrder.findUnique({ where: { id: rechargeId } })
    if (!order) {
      throw new NotFoundException('充值单不存在')
    }
    if (order.status === RechargeStatus.credited) {
      throw new BadRequestException('已入账的充值单不能拒绝')
    }
    return this.prisma.rechargeOrder.update({
      where: { id: rechargeId },
      data: {
        status: RechargeStatus.rejected,
        registeredBy: operatorId,
        note: dto.reason ?? order.note,
      },
    })
  }

  async adjust(dto: AdjustPrepaidDto, operatorId: string) {
    const account = await this.getOrCreateAccount(dto.merchantId)
    const nextAvailable = account.availableCents + dto.amountCents
    if (nextAvailable < 0) {
      throw new BadRequestException('调整后可用余额不能为负')
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.prepaidAccount.update({
        where: { id: account.id },
        data: {
          availableCents: { increment: dto.amountCents },
          adjustmentCents: { increment: dto.amountCents },
        },
      })
      await tx.prepaidLedger.create({
        data: {
          accountId: account.id,
          type: PrepaidEntryType.adjust,
          amountCents: dto.amountCents,
          balanceAfterCents: updated.availableCents,
          frozenAfterCents: updated.frozenCents,
          operatorId,
          note: dto.note,
        },
      })
      return updated
    })
  }

  async lock(dto: LockPrepaidDto, operatorId: string) {
    const account = await this.getOrCreateAccount(dto.merchantId)
    const updated = await this.prisma.prepaidAccount.update({
      where: { id: account.id },
      data: { status: PrepaidAccountStatus.locked },
    })
    await this.createAlert(account.id, dto.reason ?? '预付款账户被平台锁定', 'warning', operatorId)
    return updated
  }

  async unlock(merchantId: string) {
    const account = await this.getOrCreateAccount(merchantId)
    return this.prisma.prepaidAccount.update({
      where: { id: account.id },
      data: { status: PrepaidAccountStatus.active },
    })
  }

  async listAccounts() {
    return this.prisma.prepaidAccount.findMany({
      include: { merchant: { select: { id: true, name: true, phone: true, organization: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async reserve(
    merchantId: string,
    amountCents: number,
    relatedType: string,
    relatedId: string,
    operatorId?: string,
  ) {
    return this.prisma.$transaction((tx) =>
      this.reserveInTransaction(tx, merchantId, amountCents, relatedType, relatedId, operatorId),
    )
  }

  async reserveInTransaction(
    tx: Prisma.TransactionClient,
    merchantId: string,
    amountCents: number,
    relatedType: string,
    relatedId: string,
    operatorId?: string,
  ) {
    if (amountCents <= 0) {
      throw new BadRequestException('冻结金额必须大于 0')
    }
    const account = await tx.prepaidAccount.findUnique({ where: { merchantId } })
    if (!account) {
      throw new NotFoundException('预付款账户不存在')
    }
    if (account.status === PrepaidAccountStatus.locked) {
      throw new ForbiddenException('预付款账户已锁定，采购入口不可用')
    }
    if (account.availableCents < amountCents) {
      const shortfall = amountCents - account.availableCents
      throw new BadRequestException(
        `预付款余额不足，差额 ${formatCents(shortfall)} 元，请先充值`,
      )
    }
    const updated = await tx.prepaidAccount.update({
      where: { id: account.id },
      data: {
        availableCents: { decrement: amountCents },
        frozenCents: { increment: amountCents },
      },
    })
    await tx.prepaidLedger.create({
      data: {
        accountId: account.id,
        type: PrepaidEntryType.freeze,
        amountCents: -amountCents,
        balanceAfterCents: updated.availableCents,
        frozenAfterCents: updated.frozenCents,
        relatedType,
        relatedId,
        operatorId,
      },
    })
    return updated
  }

  async settleFrozen(
    merchantId: string,
    amountCents: number,
    relatedType: string,
    relatedId: string,
    operatorId?: string,
  ) {
    return this.prisma.$transaction((tx) =>
      this.settleFrozenInTransaction(tx, merchantId, amountCents, relatedType, relatedId, operatorId),
    )
  }

  async settleFrozenInTransaction(
    tx: Prisma.TransactionClient,
    merchantId: string,
    amountCents: number,
    relatedType: string,
    relatedId: string,
    operatorId?: string,
  ) {
    const account = await tx.prepaidAccount.findUnique({ where: { merchantId } })
    if (!account) {
      throw new NotFoundException('预付款账户不存在')
    }
    if (account.frozenCents < amountCents) {
      throw new BadRequestException('冻结金额不足')
    }
    const updated = await tx.prepaidAccount.update({
      where: { id: account.id },
      data: {
        frozenCents: { decrement: amountCents },
        totalDeductedCents: { increment: amountCents },
      },
    })
    await tx.prepaidLedger.create({
      data: {
        accountId: account.id,
        type: PrepaidEntryType.deduct,
        amountCents: -amountCents,
        balanceAfterCents: updated.availableCents,
        frozenAfterCents: updated.frozenCents,
        relatedType,
        relatedId,
        operatorId,
      },
    })
    return updated
  }

  async releaseFrozen(
    merchantId: string,
    amountCents: number,
    relatedType: string,
    relatedId: string,
    operatorId?: string,
  ) {
    return this.prisma.$transaction((tx) =>
      this.releaseFrozenInTransaction(tx, merchantId, amountCents, relatedType, relatedId, operatorId),
    )
  }

  async releaseFrozenInTransaction(
    tx: Prisma.TransactionClient,
    merchantId: string,
    amountCents: number,
    relatedType: string,
    relatedId: string,
    operatorId?: string,
  ) {
    const account = await tx.prepaidAccount.findUnique({ where: { merchantId } })
    if (!account) {
      throw new NotFoundException('预付款账户不存在')
    }
    if (account.frozenCents < amountCents) {
      throw new BadRequestException('冻结金额不足')
    }
    const updated = await tx.prepaidAccount.update({
      where: { id: account.id },
      data: {
        frozenCents: { decrement: amountCents },
        availableCents: { increment: amountCents },
      },
    })
    await tx.prepaidLedger.create({
      data: {
        accountId: account.id,
        type: PrepaidEntryType.unfreeze,
        amountCents,
        balanceAfterCents: updated.availableCents,
        frozenAfterCents: updated.frozenCents,
        relatedType,
        relatedId,
        operatorId,
      },
    })
    return updated
  }

  async refundDeducted(
    merchantId: string,
    amountCents: number,
    relatedType: string,
    relatedId: string,
    operatorId?: string,
  ) {
    return this.prisma.$transaction((tx) =>
      this.refundDeductedInTransaction(tx, merchantId, amountCents, relatedType, relatedId, operatorId),
    )
  }

  async refundDeductedInTransaction(
    tx: Prisma.TransactionClient,
    merchantId: string,
    amountCents: number,
    relatedType: string,
    relatedId: string,
    operatorId?: string,
  ) {
    const account = await tx.prepaidAccount.findUnique({ where: { merchantId } })
    if (!account) {
      throw new NotFoundException('预付款账户不存在')
    }
    const updated = await tx.prepaidAccount.update({
      where: { id: account.id },
      data: {
        availableCents: { increment: amountCents },
        totalDeductedCents: { decrement: amountCents },
      },
    })
    await tx.prepaidLedger.create({
      data: {
        accountId: account.id,
        type: PrepaidEntryType.refund,
        amountCents,
        balanceAfterCents: updated.availableCents,
        frozenAfterCents: updated.frozenCents,
        relatedType,
        relatedId,
        operatorId,
      },
    })
    return updated
  }

  async verifyIntegrity(account: PrepaidAccount) {
    const expected = account.totalRechargeCents - account.totalDeductedCents + account.adjustmentCents
    const actual = account.availableCents + account.frozenCents
    if (expected === actual) {
      return { ok: true, expected, actual }
    }

    await this.prisma.prepaidAccount.update({
      where: { id: account.id },
      data: { status: PrepaidAccountStatus.locked },
    })
    await this.createAlert(
      account.id,
      `预付款余额与流水不平：应有 ${formatCents(expected)} 元，实际 ${formatCents(actual)} 元`,
      'critical',
    )
    return { ok: false, expected, actual, locked: true }
  }

  private async createAlert(
    accountId: string,
    message: string,
    severity: string,
    actor?: string,
  ) {
    const existing = await this.prisma.systemAlert.findFirst({
      where: { type: 'prepaid_imbalance', subjectId: accountId, status: 'open' },
    })
    if (existing) {
      return existing
    }
    return this.prisma.systemAlert.create({
      data: {
        type: 'prepaid_imbalance',
        subjectType: 'prepaid_account',
        subjectId: accountId,
        message,
        severity,
        createdBy: actor,
      },
    })
  }

  private generateRechargeNo(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return `RC${date}${randomBytes(3).toString('hex').toUpperCase()}`
  }
}
