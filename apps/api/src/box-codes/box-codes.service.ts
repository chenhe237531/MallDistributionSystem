import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  BoxCode,
  BoxCodeStatus,
  Prisma,
  ProcurementStatus as PrismaProcurementStatus,
} from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { Role } from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import { VoidBoxCodeDto } from './dto/box-code.dto'
import type { AuthUser } from '../auth/auth-user.type'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const VOIDABLE_STATUSES: BoxCodeStatus[] = [BoxCodeStatus.generated]

@Injectable()
export class BoxCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async generate(procurementOrderId: string, actor: AuthUser) {
    if (!actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('只有平台可以在出库环节生成盒码')
    }
    const order = await this.prisma.procurementOrder.findUnique({
      where: { id: procurementOrderId },
      include: { items: true },
    })
    if (!order) {
      throw new NotFoundException('采购单不存在')
    }
    if (
      order.status === PrismaProcurementStatus.cancelled ||
      order.status === PrismaProcurementStatus.refunded
    ) {
      throw new BadRequestException('已取消或退款的采购单不能生成盒码')
    }

    const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0)
    const existing = await this.prisma.boxCode.findMany({
      where: { procurementOrderId },
      orderBy: { createdAt: 'asc' },
    })
    if (existing.length >= totalQuantity) {
      return existing
    }
    if (existing.length > 0) {
      throw new ConflictException('盒码生成记录不完整，请人工核查后处理')
    }

    const channel = await this.prisma.channelIdentity.findFirst({
      where: { userId: order.merchantId, type: 'merchant', status: 'active' },
    })
    if (!channel) {
      throw new BadRequestException('商家渠道身份不可用，无法生成盒码')
    }

    const rows: Prisma.BoxCodeCreateManyInput[] = []
    for (const item of order.items) {
      for (let index = 0; index < item.quantity; index += 1) {
        const code = await this.generateUniqueCode()
        rows.push({
          code,
          qrPayload: `${process.env.PUBLIC_BASE_URL ?? 'https://mall.example'}/activate?code=${code}`,
          procurementOrderId,
          procurementItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          skuCode: item.skuCode,
          batchId: item.batchId,
          batchNo: item.batchNo,
          merchantId: order.merchantId,
          channelId: channel.id,
        })
      }
    }
    await this.prisma.boxCode.createMany({ data: rows })
    await this.prisma.auditLog.createMany({
      data: rows.map((row) => ({
        actorId: actor.sub,
        actorRole: actor.role,
        action: 'box_code.generate',
        resourceType: 'box_code',
        resourceId: row.code,
        orderId: null,
        orderNo: order.orderNo,
        boxCode: row.code,
        customerId: null,
        channelId: row.channelId,
        merchantId: row.merchantId,
        detail: { productName: row.productName, batchNo: row.batchNo, procurementOrderId },
      })),
    })

    return this.prisma.boxCode.findMany({
      where: { procurementOrderId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async list(actor: AuthUser, status?: string) {
    if (!actor.roles.includes(Role.PLATFORM) && !actor.roles.includes(Role.MERCHANT)) {
      throw new ForbiddenException('无权查看盒码列表')
    }
    const where: Prisma.BoxCodeWhereInput = actor.roles.includes(Role.PLATFORM)
      ? {}
      : { merchantId: actor.sub }
    if (status) {
      where.status = status as BoxCodeStatus
    }
    return this.prisma.boxCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  }

  async labels(procurementOrderId: string, actor: AuthUser) {
    const order = await this.prisma.procurementOrder.findUnique({
      where: { id: procurementOrderId },
    })
    if (!order) {
      throw new NotFoundException('采购单不存在')
    }
    if (!actor.roles.includes(Role.PLATFORM) && order.merchantId !== actor.sub) {
      throw new ForbiddenException('无权导出该采购单的盒码标签')
    }
    const codes = await this.prisma.boxCode.findMany({
      where: { procurementOrderId },
      orderBy: { createdAt: 'asc' },
    })
    return codes.map((code) => ({
      code: code.code,
      qrPayload: code.qrPayload,
      productName: code.productName,
      skuCode: code.skuCode,
      batchNo: code.batchNo,
      channelId: code.channelId,
      status: code.status,
    }))
  }

  async getOne(id: string, actor: AuthUser) {
    const code = await this.prisma.boxCode.findUnique({ where: { id } })
    if (!code) {
      throw new NotFoundException('盒码不存在')
    }
    if (!actor.roles.includes(Role.PLATFORM) && code.merchantId !== actor.sub) {
      throw new ForbiddenException('无权查看该盒码')
    }
    return code
  }

  async resolve(codeValue: string) {
    const code = await this.prisma.boxCode.findUnique({ where: { code: codeValue } })
    if (!code) {
      return { valid: false, reason: 'NOT_FOUND' as const }
    }
    if (code.status === BoxCodeStatus.voided) {
      return { valid: false, reason: 'VOIDED' as const, productName: code.productName }
    }
    return {
      valid: true,
      code: code.code,
      status: code.status,
      productName: code.productName,
      skuCode: code.skuCode,
      batchNo: code.batchNo,
      channelId: code.channelId,
      merchantId: code.merchantId,
    }
  }

  async void(id: string, dto: VoidBoxCodeDto, actor: AuthUser) {
    const code = await this.prisma.boxCode.findUnique({ where: { id } })
    if (!code) {
      throw new NotFoundException('盒码不存在')
    }
    if (!VOIDABLE_STATUSES.includes(code.status)) {
      throw new BadRequestException('已激活或已使用的盒码不能作废')
    }
    const updated = await this.prisma.boxCode.update({
      where: { id },
      data: { status: BoxCodeStatus.voided, voidReason: dto.reason ?? '平台作废' },
    })
    await this.auditService.record({
      actor,
      action: 'box_code.void',
      resourceType: 'box_code',
      resourceId: code.id,
      boxCode: code.code,
      merchantId: code.merchantId,
      channelId: code.channelId,
      detail: { reason: dto.reason ?? '平台作废' },
    })
    return updated
  }

  async replace(id: string, actor: AuthUser) {
    const code = await this.prisma.boxCode.findUnique({ where: { id } })
    if (!code) {
      throw new NotFoundException('盒码不存在')
    }
    if (!VOIDABLE_STATUSES.includes(code.status)) {
      throw new BadRequestException('已激活或已使用的盒码不能补码')
    }
    const newCode = await this.generateUniqueCode()

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.boxCode.update({
        where: { id },
        data: { status: BoxCodeStatus.voided, voidReason: '补码作废' },
      })
      return tx.boxCode.create({
        data: {
          code: newCode,
          qrPayload: `${process.env.PUBLIC_BASE_URL ?? 'https://mall.example'}/activate?code=${newCode}`,
          procurementOrderId: code.procurementOrderId,
          procurementItemId: code.procurementItemId,
          productId: code.productId,
          productName: code.productName,
          skuCode: code.skuCode,
          batchId: code.batchId,
          batchNo: code.batchNo,
          merchantId: code.merchantId,
          channelId: code.channelId,
        },
      })
    })
    await this.auditService.record({
      actor,
      action: 'box_code.replace',
      resourceType: 'box_code',
      resourceId: created.id,
      boxCode: created.code,
      merchantId: created.merchantId,
      channelId: created.channelId,
      detail: { replacedCode: code.code },
    })
    return created
  }

  async freezeUnactivated(channelId: string, actor: AuthUser) {
    const channel = await this.prisma.channelIdentity.findUnique({ where: { id: channelId } })
    if (!channel) {
      throw new NotFoundException('渠道码不存在')
    }
    const generated = await this.prisma.boxCode.findMany({
      where: { channelId, status: BoxCodeStatus.generated },
    })
    let replaced = 0
    for (const box of generated) {
      const newCode = await this.generateUniqueCode()
      await this.prisma.$transaction(async (tx) => {
        await tx.boxCode.update({
          where: { id: box.id },
          data: { status: BoxCodeStatus.voided, voidReason: '未激活盒码批量冻结补码' },
        })
        await tx.boxCode.create({
          data: {
            code: newCode,
            qrPayload: `${process.env.PUBLIC_BASE_URL ?? 'https://mall.example'}/activate?code=${newCode}`,
            procurementOrderId: box.procurementOrderId,
            procurementItemId: box.procurementItemId,
            productId: box.productId,
            productName: box.productName,
            skuCode: box.skuCode,
            batchId: box.batchId,
            batchNo: box.batchNo,
            merchantId: box.merchantId,
            channelId: box.channelId,
          },
        })
      })
      replaced += 1
    }
    await this.auditService.record({
      actor,
      action: 'box_code.batch_freeze',
      resourceType: 'box_code',
      resourceId: channelId,
      channelId,
      merchantId: channel.userId,
      detail: { frozen: replaced, channelCode: channel.code },
    })
    return { frozen: replaced, replaced, channelCode: channel.code }
  }

  async createSupplement(originalId: string) {
    const original = await this.prisma.boxCode.findUnique({ where: { id: originalId } })
    if (!original) {
      throw new NotFoundException('原盒码不存在')
    }
    const newCode = await this.generateUniqueCode()
    return this.prisma.boxCode.create({
      data: {
        code: newCode,
        qrPayload: `${process.env.PUBLIC_BASE_URL ?? 'https://mall.example'}/activate?code=${newCode}`,
        procurementOrderId: original.procurementOrderId,
        procurementItemId: original.procurementItemId,
        productId: original.productId,
        productName: original.productName,
        skuCode: original.skuCode,
        batchId: original.batchId,
        batchNo: original.batchNo,
        merchantId: original.merchantId,
        channelId: original.channelId,
      },
    })
  }

  async voidForOrderInTransaction(
    tx: Prisma.TransactionClient,
    procurementOrderId: string,
    reason: string,
  ): Promise<void> {
    await tx.boxCode.updateMany({
      where: { procurementOrderId, status: BoxCodeStatus.generated },
      data: { status: BoxCodeStatus.voided, voidReason: reason },
    })
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const bytes = randomBytes(10)
      let code = 'BX'
      for (const byte of bytes) {
        code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
      }
      const existing = await this.prisma.boxCode.findUnique({ where: { code } })
      if (!existing) {
        return code
      }
    }
    throw new BadRequestException('盒码生成失败，请重试')
  }
}
