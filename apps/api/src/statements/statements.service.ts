import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  CommissionStatus,
  Prisma,
  StatementStatus as PrismaStatementStatus,
} from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { formatCents, Role } from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { ChannelsService } from '../channels/channels.service'
import { NotificationsService } from '../notifications/notifications.service'
import { asRoleArray } from '../prisma/array-values'
import { PrismaService } from '../prisma/prisma.service'
import {
  GenerateStatementDto,
  RegisterVoucherDto,
  ResolveDifferenceDto,
  StatementAdjustmentDto,
  StatementDifferenceDto,
} from './dto/statement.dto'
import type { AuthUser } from '../auth/auth-user.type'

type DbClient = Prisma.TransactionClient

@Injectable()
export class StatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly channelsService: ChannelsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async generate(dto: GenerateStatementDto, actor: AuthUser) {
    if (!actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('只有平台可以生成对账单')
    }
    const subject = await this.prisma.user.findUnique({ where: { id: dto.subjectId } })
    if (!subject || !asRoleArray(subject.roles).includes(dto.subjectType as Role)) {
      throw new BadRequestException('对账主体不存在或角色不匹配')
    }
    await this.channelsService.assertNotPausedForSubject(dto.subjectId, dto.subjectType)
    const existing = await this.prisma.statement.findUnique({
      where: {
        period_subjectType_subjectId: {
          period: dto.period,
          subjectType: dto.subjectType,
          subjectId: dto.subjectId,
        },
      },
    })
    if (existing) {
      throw new ConflictException('该周期该主体的对账单已存在')
    }

    const { start, end } = periodRange(dto.period)
    const previous = await this.prisma.statement.findFirst({
      where: {
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        period: { lt: dto.period },
      },
      orderBy: { period: 'desc' },
    })
    const openingUnsettledCents =
      previous && previous.status !== PrismaStatementStatus.settled
        ? previous.totalPayableCents - previous.voucherRegisteredCents
        : 0

    const lines = await this.buildLines(dto.subjectType, dto.subjectId, start, end)
    const newPayableCents = lines.reduce((sum, line) => sum + line.amountCents, 0)
    const totalPayableCents = openingUnsettledCents + newPayableCents

    const statement = await this.prisma.statement.create({
      data: {
        statementNo: this.generateStatementNo(dto.period),
        period: dto.period,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        status: PrismaStatementStatus.pending,
        openingUnsettledCents,
        newPayableCents,
        adjustmentCents: 0,
        totalPayableCents,
        voucherMissingCents: Math.max(totalPayableCents, 0),
        differenceCents: totalPayableCents,
        lines: { create: lines },
      },
      include: { lines: true },
    })
    await this.auditService.record({
      actor,
      action: 'statement.generate',
      resourceType: 'statement',
      resourceId: statement.id,
      merchantId: dto.subjectType === 'merchant' ? dto.subjectId : null,
      detail: {
        statementNo: statement.statementNo,
        period: statement.period,
        subjectType: statement.subjectType,
        totalPayableCents: statement.totalPayableCents,
      },
    })
    await this.notificationsService.emit({
      type: 'statement_generated',
      recipientId: statement.subjectId,
      recipientRole: statement.subjectType as unknown as Role,
      subjectType: 'statement',
      subjectId: statement.id,
      title: '对账单已生成',
      body: `${statement.period} 对账单已生成，本期应付 ${formatCents(statement.totalPayableCents)} 元，请及时核对。`,
      templateCode: 'statement_generated',
      dedupeKey: `statement_generated:${statement.id}`,
      payload: { statementId: statement.id, period: statement.period },
    })
    return statement
  }

  async list(actor: AuthUser, period?: string) {
    const where: Prisma.StatementWhereInput = actor.roles.includes(Role.PLATFORM)
      ? period
        ? { period }
        : {}
      : period
        ? { subjectId: actor.sub, period }
        : { subjectId: actor.sub }
    return this.prisma.statement.findMany({
      where,
      include: { lines: true, vouchers: true, differences: true },
      orderBy: [{ period: 'desc' }, { generatedAt: 'desc' }],
    })
  }

  async getOne(id: string, actor: AuthUser) {
    const statement = await this.prisma.statement.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
        vouchers: { orderBy: { createdAt: 'asc' } },
        differences: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!statement) {
      throw new NotFoundException('对账单不存在')
    }
    this.assertAccess(statement, actor)
    return statement
  }

  async registerVoucher(id: string, dto: RegisterVoucherDto, actor: AuthUser) {
    const statement = await this.prisma.statement.findUnique({ where: { id } })
    if (!statement) {
      throw new NotFoundException('对账单不存在')
    }
    if (statement.status === PrismaStatementStatus.settled) {
      throw new BadRequestException('已结清账单不能新增票证')
    }
    const duplicate = await this.prisma.statementVoucher.findUnique({
      where: { voucherNo: dto.voucherNo },
    })
    if (duplicate) {
      throw new ConflictException('该票证号码已登记')
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockStatementForUpdate(tx, id)
      const locked = await tx.statement.findUniqueOrThrow({ where: { id } })
      await tx.statementVoucher.create({
        data: {
          statementId: id,
          voucherNo: dto.voucherNo,
          title: dto.title,
          taxNo: dto.taxNo,
          amountCents: dto.amountCents,
          issuedAt: new Date(dto.issuedAt),
          imageUrl: dto.imageUrl,
          registeredBy: actor.sub,
        },
      })
      const remaining = locked.totalPayableCents - locked.voucherRegisteredCents
      const overAmount = dto.amountCents - remaining
      let difference = overAmount
      if (overAmount > 0) {
        await tx.statementDifference.create({
          data: {
            statementId: id,
            amountCents: overAmount,
            reason: '票证金额超出账单应付，需人工核对',
            createdBy: actor.sub,
          },
        })
        difference = overAmount
      }
      const voucherRegisteredCents = locked.voucherRegisteredCents + dto.amountCents
      const voucherMissingCents = Math.max(
        locked.totalPayableCents - voucherRegisteredCents,
        0,
      )
      const differenceCents = locked.totalPayableCents - voucherRegisteredCents
      return tx.statement.update({
        where: { id },
        data: {
          voucherRegisteredCents,
          voucherMissingCents,
          differenceCents,
          status:
            overAmount > 0
              ? PrismaStatementStatus.disputed
              : locked.status === PrismaStatementStatus.disputed && voucherMissingCents === 0
                ? PrismaStatementStatus.reconciled
                : locked.status,
        },
        include: { lines: true, vouchers: true, differences: true },
      })
    })
    await this.notificationsService.emit({
      type: 'voucher_registered',
      recipientId: statement.subjectId,
      recipientRole: statement.subjectType as unknown as Role,
      subjectType: 'statement',
      subjectId: statement.id,
      title: '票证已登记',
      body: `对账单 ${statement.statementNo} 已登记票证 ${dto.voucherNo}，金额 ${formatCents(dto.amountCents)} 元。`,
      templateCode: 'voucher_registered',
      dedupeKey: `voucher_registered:${id}:${dto.voucherNo}`,
      payload: { statementId: statement.id, voucherNo: dto.voucherNo },
    })
    return updated
  }

  async addAdjustment(id: string, dto: StatementAdjustmentDto, actor: AuthUser) {
    const statement = await this.getStatementRaw(id)
    if (statement.status === PrismaStatementStatus.settled) {
      throw new BadRequestException('已结清账单不能直接调整，请先反结清')
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockStatementForUpdate(tx, id)
      const locked = await tx.statement.findUniqueOrThrow({ where: { id } })
      const adjustmentCents = locked.adjustmentCents + dto.amountCents
      const totalPayableCents =
        locked.openingUnsettledCents + locked.newPayableCents + adjustmentCents
      await tx.statementLine.create({
        data: {
          statementId: id,
          sourceType: 'manual_adjustment',
          sourceId: `manual-${Date.now()}`,
          description: dto.reason,
          baseAmountCents: 0,
          amountCents: dto.amountCents,
        },
      })
      return tx.statement.update({
        where: { id },
        data: {
          adjustmentCents,
          totalPayableCents,
          voucherMissingCents: Math.max(totalPayableCents - locked.voucherRegisteredCents, 0),
          differenceCents: totalPayableCents - locked.voucherRegisteredCents,
        },
        include: { lines: true, vouchers: true, differences: true },
      })
    })
  }

  async reconcile(id: string, actor: AuthUser) {
    const statement = await this.getStatementRaw(id)
    if (statement.status === PrismaStatementStatus.settled) {
      throw new BadRequestException('已结清账单不能重复对账')
    }
    return this.prisma.statement.update({
      where: { id },
      data: { status: PrismaStatementStatus.reconciled, reconciledAt: new Date() },
    })
  }

  async addDifference(id: string, dto: StatementDifferenceDto, actor: AuthUser) {
    await this.getStatementRaw(id)
    return this.prisma.$transaction(async (tx) => {
      const difference = await tx.statementDifference.create({
        data: {
          statementId: id,
          amountCents: dto.amountCents,
          reason: dto.reason,
          createdBy: actor.sub,
        },
      })
      await tx.statement.update({
        where: { id },
        data: { status: PrismaStatementStatus.disputed },
      })
      return difference
    })
  }

  async resolveDifference(
    id: string,
    differenceId: string,
    dto: ResolveDifferenceDto,
    actor: AuthUser,
  ) {
    const difference = await this.prisma.statementDifference.findFirst({
      where: { id: differenceId, statementId: id },
    })
    if (!difference) {
      throw new NotFoundException('差异记录不存在')
    }
    return this.prisma.$transaction(async (tx) => {
      const resolved = await tx.statementDifference.update({
        where: { id: differenceId },
        data: { status: 'resolved', resolution: dto.resolution, createdBy: actor.sub },
      })
      const openCount = await tx.statementDifference.count({
        where: { statementId: id, status: 'open' },
      })
      if (openCount === 0) {
        await tx.statement.update({
          where: { id },
          data: { status: PrismaStatementStatus.reconciled, reconciledAt: new Date() },
        })
      }
      return resolved
    })
  }

  async settle(id: string, actor: AuthUser) {
    const statement = await this.getStatementRaw(id)
    if (statement.status !== PrismaStatementStatus.reconciled) {
      throw new BadRequestException('只有已对账账单可以结清')
    }
    if (statement.totalPayableCents > statement.voucherRegisteredCents) {
      const missing = statement.totalPayableCents - statement.voucherRegisteredCents
      throw new BadRequestException(
        `已登记票证不足，仍有 ${formatCents(missing)} 元未取得票证，不能结清`,
      )
    }
    const settled = await this.prisma.statement.update({
      where: { id },
      data: { status: PrismaStatementStatus.settled, settledAt: new Date() },
    })
    await this.auditService.record({
      actor,
      action: 'statement.settle',
      resourceType: 'statement',
      resourceId: settled.id,
      merchantId: settled.subjectType === 'merchant' ? settled.subjectId : null,
      detail: {
        statementNo: settled.statementNo,
        period: settled.period,
        totalPayableCents: settled.totalPayableCents,
      },
    })
    return settled
  }

  async reopen(id: string, actor: AuthUser) {
    const statement = await this.getStatementRaw(id)
    if (statement.status !== PrismaStatementStatus.settled) {
      throw new BadRequestException('只有已结清账单可以反结清')
    }
    return this.prisma.statement.update({
      where: { id },
      data: {
        status: PrismaStatementStatus.reconciled,
        settledAt: null,
        reopenedAt: new Date(),
      },
    })
  }

  async overview() {
    const statements = await this.prisma.statement.findMany()
    return {
      totalPayableCents: statements.reduce((sum, item) => sum + item.totalPayableCents, 0),
      pendingCount: statements.filter((item) => item.status === 'pending').length,
      disputedCount: statements.filter((item) => item.status === 'disputed').length,
      missingVoucherCents: statements.reduce(
        (sum, item) => sum + item.voucherMissingCents,
        0,
      ),
      differenceCents: statements.reduce((sum, item) => sum + item.differenceCents, 0),
    }
  }

  /**
   * 对 statement 汇总字段做读改写前加行锁，防止并发退款冲回/票证登记丢失更新。
   */
  private async lockStatementForUpdate(tx: DbClient, statementId: string): Promise<void> {
    await this.prisma.lockRow(tx, 'Statement', statementId)
  }

  /**
   * 在持锁状态下把一笔调整额落到对账单汇总字段（调整行由调用方创建）。
   */
  private async applyAdjustmentToStatement(
    tx: DbClient,
    statementId: string,
    amountCents: number,
  ) {
    const statement = await tx.statement.findUnique({ where: { id: statementId } })
    if (!statement) {
      return
    }
    const adjustmentCents = statement.adjustmentCents + amountCents
    const totalPayableCents =
      statement.openingUnsettledCents + statement.newPayableCents + adjustmentCents
    await tx.statement.update({
      where: { id: statementId },
      data: {
        adjustmentCents,
        totalPayableCents,
        voucherMissingCents: Math.max(totalPayableCents - statement.voucherRegisteredCents, 0),
        differenceCents: totalPayableCents - statement.voucherRegisteredCents,
      },
    })
  }

  /**
   * refundedQuantity 为该订单项累计已退数量（含本次），
   * 按累计数量计算目标冲回总额，再扣除已冲回部分，避免多次部分退款时按次舍入产生偏差。
   */
  async addRefundAdjustmentInTransaction(
    tx: DbClient,
    orderItemId: string,
    refundedQuantity: number,
    itemQuantity: number,
  ) {
    const commissions = await tx.commission.findMany({ where: { orderItemId } })
    for (const commission of commissions) {
      const lines = await tx.statementLine.findMany({
        where: { sourceType: 'commission', sourceId: commission.id },
        include: { statement: true },
      })
      for (const line of lines) {
        if (line.statement.status === PrismaStatementStatus.settled) {
          continue
        }
        await this.lockStatementForUpdate(tx, line.statementId)
        const targetTotal = -Math.round((line.amountCents * refundedQuantity) / itemQuantity)
        const prior = await tx.statementLine.aggregate({
          where: {
            statementId: line.statementId,
            sourceType: 'refund_adjustment',
            sourceId: commission.id,
          },
          _sum: { amountCents: true },
        })
        const amountCents = targetTotal - (prior._sum.amountCents ?? 0)
        if (amountCents === 0) {
          continue
        }
        await tx.statementLine.create({
          data: {
            statementId: line.statementId,
            sourceType: 'refund_adjustment',
            sourceId: commission.id,
            description: `退款冲回 · 佣金 ${commission.commissionNo}`,
            baseAmountCents: 0,
            amountCents,
          },
        })
        await this.applyAdjustmentToStatement(tx, line.statementId, amountCents)
      }
    }
  }

  /**
   * 退款后商家收入行（order_settlement）冲回：currentIncome 为重算后的当前商家收入净额。
   * 行金额（income0）在入账时快照，累计冲回目标 = -(income0 - currentIncome)，
   * 本次冲回 = 累计目标 - 已冲回累计，与佣金冲回一致防重入、防多次部分退款舍入残留。
   */
  async addSettlementRefundAdjustmentInTransaction(
    tx: DbClient,
    settlementId: string | null,
    currentIncomeCents: number,
  ) {
    if (!settlementId) {
      return
    }
    const lines = await tx.statementLine.findMany({
      where: { sourceType: 'order_settlement', sourceId: settlementId },
      include: { statement: true },
    })
    for (const line of lines) {
      if (line.statement.status === PrismaStatementStatus.settled) {
        continue
      }
      await this.lockStatementForUpdate(tx, line.statementId)
      const targetTotal = -(line.amountCents - currentIncomeCents)
      const prior = await tx.statementLine.aggregate({
        where: {
          statementId: line.statementId,
          sourceType: 'refund_adjustment',
          sourceId: settlementId,
        },
        _sum: { amountCents: true },
      })
      const amountCents = targetTotal - (prior._sum.amountCents ?? 0)
      if (amountCents === 0) {
        continue
      }
      await tx.statementLine.create({
        data: {
          statementId: line.statementId,
          sourceType: 'refund_adjustment',
          sourceId: settlementId,
          description: '退款冲回 · 商家收入',
          baseAmountCents: 0,
          amountCents,
        },
      })
      await this.applyAdjustmentToStatement(tx, line.statementId, amountCents)
    }
  }

  async exportExcel(id: string, actor: AuthUser): Promise<Buffer> {
    const statement = await this.getOne(id, actor)
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('对账单')
    sheet.addRow(['对账单号', statement.statementNo])
    sheet.addRow(['周期', statement.period])
    sheet.addRow(['主体', statement.subjectType, statement.subjectId])
    sheet.addRow(['状态', statement.status])
    sheet.addRow([])
    sheet.addRow(['来源', '说明', '基数(分)', '比例(bps)', '层级', '规则版本', '金额(分)'])
    for (const line of statement.lines) {
      sheet.addRow([
        line.sourceType,
        line.description,
        line.baseAmountCents,
        line.rateBps ?? '',
        line.level ?? '',
        line.ruleVersion ?? '',
        line.amountCents,
      ])
    }
    sheet.addRow([])
    sheet.addRow(['上期未结清', statement.openingUnsettledCents])
    sheet.addRow(['本期新增应付', statement.newPayableCents])
    sheet.addRow(['调整项', statement.adjustmentCents])
    sheet.addRow(['本期应付合计', statement.totalPayableCents])
    sheet.addRow(['已登记票证', statement.voucherRegisteredCents])
    sheet.addRow(['未取得票证', statement.voucherMissingCents])
    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  async exportPdf(id: string, actor: AuthUser): Promise<Buffer> {
    const statement = await this.getOne(id, actor)
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const candidates = [
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
        '/Library/Fonts/Arial Unicode.ttf',
      ]
      const fontPath = candidates.find((path) => existsSync(path))
      if (fontPath) {
        doc.font(fontPath)
      } else {
        doc.font('Helvetica')
      }

      doc.fontSize(16).text(`对账单 ${statement.statementNo}`)
      doc.moveDown(0.5)
      doc.fontSize(10)
      doc.text(`周期：${statement.period}    主体：${statement.subjectType} / ${statement.subjectId}`)
      doc.text(`状态：${statement.status}`)
      doc.moveDown()
      for (const line of statement.lines) {
        doc.text(`${line.sourceType}  ${line.description}  金额：${formatCents(line.amountCents)} 元`)
      }
      doc.moveDown()
      doc.text(`上期未结清：${formatCents(statement.openingUnsettledCents)} 元`)
      doc.text(`本期新增应付：${formatCents(statement.newPayableCents)} 元`)
      doc.text(`调整项：${formatCents(statement.adjustmentCents)} 元`)
      doc.text(`本期应付合计：${formatCents(statement.totalPayableCents)} 元`)
      doc.text(`已登记票证：${formatCents(statement.voucherRegisteredCents)} 元`)
      doc.text(`未取得票证：${formatCents(statement.voucherMissingCents)} 元`)
      doc.end()
    })
  }

  private async buildLines(
    subjectType: string,
    subjectId: string,
    start: Date,
    end: Date,
  ): Promise<Prisma.StatementLineCreateWithoutStatementInput[]> {
    if (subjectType === 'partner') {
      const commissions = await this.prisma.commission.findMany({
        where: {
          beneficiaryId: subjectId,
          createdAt: { gte: start, lt: end },
          status: {
            notIn: [CommissionStatus.invalid, CommissionStatus.disputed],
          },
        },
      })
      const orders = await this.prisma.salesOrder.findMany({
        where: { id: { in: commissions.map((item) => item.orderId) } },
        select: { id: true, orderNo: true },
      })
      const orderNoById = new Map(orders.map((order) => [order.id, order.orderNo]))
      return commissions
        .map((commission) => {
          const amountCents = commission.amountCents - commission.reversedAmountCents
          return {
            sourceType: 'commission',
            sourceId: commission.id,
            description: `${commission.level} 级佣金 · 订单 ${orderNoById.get(commission.orderId) ?? commission.orderId}`,
            baseAmountCents: commission.baseAmountCents,
            rateBps: commission.rateBps,
            level: commission.level,
            ruleVersion: commission.ruleVersion,
            amountCents,
          }
        })
        .filter((line) => line.amountCents !== 0)
    }

    if (subjectType === 'merchant') {
      const orders = await this.prisma.salesOrder.findMany({
        where: { merchantId: subjectId, paidAt: { gte: start, lt: end } },
        select: { id: true, orderNo: true },
      })
      const settlements = await this.prisma.orderSettlement.findMany({
        where: { orderId: { in: orders.map((order) => order.id) } },
      })
      const orderNoById = new Map(orders.map((order) => [order.id, order.orderNo]))
      return settlements.map((settlement) => ({
        sourceType: 'order_settlement',
        sourceId: settlement.id,
        description: `订单 ${orderNoById.get(settlement.orderId) ?? settlement.orderId} 商家收入`,
        baseAmountCents: settlement.merchantIncomeCents,
        amountCents: settlement.merchantIncomeCents,
      }))
    }

    const procurementOrders = await this.prisma.procurementOrder.findMany({
      where: {
        supplierId: subjectId,
        createdAt: { gte: start, lt: end },
        status: { in: ['received', 'completed', 'refunded'] },
      },
    })
    return procurementOrders.map((order) => ({
      sourceType: 'procurement_order',
      sourceId: order.id,
      description: `采购单 ${order.orderNo}${order.status === 'refunded' ? '（退款）' : ''}`,
      baseAmountCents: order.totalAmountCents,
      amountCents: order.status === 'refunded' ? -order.totalAmountCents : order.totalAmountCents,
    }))
  }

  private async getStatementRaw(id: string) {
    const statement = await this.prisma.statement.findUnique({ where: { id } })
    if (!statement) {
      throw new NotFoundException('对账单不存在')
    }
    return statement
  }

  private assertAccess(
    statement: { subjectId: string },
    actor: AuthUser,
  ): void {
    if (actor.roles.includes(Role.PLATFORM) || statement.subjectId === actor.sub) {
      return
    }
    throw new ForbiddenException('无权查看该对账单')
  }

  private generateStatementNo(period: string): string {
    return `ST${period.replace('-', '')}${randomBytes(3).toString('hex').toUpperCase()}`
  }
}

function periodRange(period: string): { start: Date; end: Date } {
  const [year, month] = period.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return { start, end }
}
