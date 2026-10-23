import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ChannelType, Prisma } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { AuditService } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from '../auth/auth-user.type'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async mine(userId: string) {
    return this.prisma.channelIdentity.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async resolve(code: string) {
    const channel = await this.prisma.channelIdentity.findUnique({
      where: { code },
      include: { user: { select: { id: true, name: true, organization: true } } },
    })
    if (!channel) {
      return { valid: false }
    }
    return {
      valid: channel.status === 'active',
      code: channel.code,
      type: channel.type,
      subjectName: channel.user.organization?.name ?? channel.user.name,
    }
  }

  async disable(id: string, reason: string | undefined, actor: AuthUser) {
    const channel = await this.prisma.channelIdentity.findUnique({ where: { id } })
    if (!channel) {
      throw new NotFoundException('渠道码不存在')
    }
    const updated = await this.prisma.channelIdentity.update({
      where: { id },
      data: { status: 'inactive' },
    })
    await this.auditService.record({
      actor,
      action: 'channel.disable',
      resourceType: 'channel',
      resourceId: channel.id,
      channelId: channel.id,
      merchantId: channel.type === ChannelType.merchant ? channel.userId : null,
      detail: { code: channel.code, reason: reason ?? '平台停用' },
    })
    return updated
  }

  async resume(id: string, actor: AuthUser) {
    const channel = await this.prisma.channelIdentity.findUnique({ where: { id } })
    if (!channel) {
      throw new NotFoundException('渠道码不存在')
    }
    if (channel.status !== 'inactive' && channel.riskStatus !== 'paused') {
      throw new BadRequestException('只有已停用或风控暂停的渠道码可以恢复')
    }
    const updated = await this.prisma.channelIdentity.update({
      where: { id },
      data: {
        status: 'active',
        riskStatus: 'normal',
        riskReason: null,
        riskUpdatedAt: new Date(),
      },
    })
    await this.auditService.record({
      actor,
      action: 'channel.resume',
      resourceType: 'channel',
      resourceId: channel.id,
      channelId: channel.id,
      merchantId: channel.type === ChannelType.merchant ? channel.userId : null,
      detail: { code: channel.code },
    })
    return updated
  }

  async reissue(id: string, actor: AuthUser) {
    const channel = await this.prisma.channelIdentity.findUnique({ where: { id } })
    if (!channel) {
      throw new NotFoundException('渠道码不存在')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const newCode = await this.generateUniqueCode(tx, channel.type)
      await tx.channelIdentity.update({
        where: { id },
        data: { status: 'inactive' },
      })
      const created = await tx.channelIdentity.create({
        data: {
          code: newCode,
          type: channel.type,
          userId: channel.userId,
          status: 'active',
        },
      })

      const generatedBoxCodes = await tx.boxCode.findMany({
        where: { channelId: id, status: 'generated' },
      })
      for (const box of generatedBoxCodes) {
        const replacementCode = await this.generateUniqueBoxCode(tx)
        await tx.boxCode.update({
          where: { id: box.id },
          data: { status: 'voided', voidReason: '渠道码外泄批量冻结' },
        })
        await tx.boxCode.create({
          data: {
            code: replacementCode,
            qrPayload: `${process.env.PUBLIC_BASE_URL ?? 'https://mall.example'}/activate?code=${replacementCode}`,
            procurementOrderId: box.procurementOrderId,
            procurementItemId: box.procurementItemId,
            productId: box.productId,
            productName: box.productName,
            skuCode: box.skuCode,
            batchId: box.batchId,
            batchNo: box.batchNo,
            merchantId: box.merchantId,
            channelId: created.id,
          },
        })
      }

      return {
        previousChannelId: id,
        channel: created,
        frozenBoxCodes: generatedBoxCodes.length,
      }
    })

    await this.auditService.record({
      actor,
      action: 'channel.reissue',
      resourceType: 'channel',
      resourceId: result.channel.id,
      channelId: result.channel.id,
      merchantId: channel.type === ChannelType.merchant ? channel.userId : null,
      detail: {
        previousChannelId: id,
        previousCode: channel.code,
        newCode: result.channel.code,
        frozenBoxCodes: result.frozenBoxCodes,
      },
    })
    return result
  }

  async assertNotPausedForSubject(userId: string, subjectType: string): Promise<void> {
    if (subjectType !== 'merchant' && subjectType !== 'partner') {
      return
    }
    const channel = await this.prisma.channelIdentity.findFirst({
      where: { userId, type: subjectType as ChannelType },
    })
    if (channel?.riskStatus === 'paused') {
      throw new ForbiddenException('渠道月退款率超过 20%，账单已暂停进入对账，请人工审核')
    }
  }

  async pauseForRefundRate(channelId: string, ratePercent: string): Promise<void> {
    const channel = await this.prisma.channelIdentity.findUnique({ where: { id: channelId } })
    if (!channel || channel.riskStatus === 'paused') {
      return
    }
    await this.prisma.channelIdentity.update({
      where: { id: channelId },
      data: {
        riskStatus: 'paused',
        riskReason: `月退款率 ${ratePercent}，超过 20% 阈值`,
        riskUpdatedAt: new Date(),
      },
    })
    await this.prisma.systemAlert.create({
      data: {
        type: 'channel_refund_rate_high',
        subjectType: 'channel',
        subjectId: channelId,
        message: `渠道 ${channel.code} 月退款率 ${ratePercent} 超过 20%，账单已暂停进入对账`,
        severity: 'critical',
      },
    })
  }

  private async generateUniqueCode(
    client: Prisma.TransactionClient | PrismaService,
    type: ChannelType,
  ): Promise<string> {
    const prefix = type === 'merchant' ? 'M' : type === 'partner' ? 'P' : 'S'
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const bytes = randomBytes(10)
      let suffix = ''
      for (const byte of bytes) {
        suffix += CODE_ALPHABET[byte % CODE_ALPHABET.length]
      }
      const code = `${prefix}${suffix.slice(0, 8)}`
      const existing = await client.channelIdentity.findUnique({ where: { code } })
      if (!existing) {
        return code
      }
    }
    throw new BadRequestException('渠道码生成失败，请重试')
  }

  private async generateUniqueBoxCode(client: Prisma.TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const bytes = randomBytes(10)
      let code = 'BX'
      for (const byte of bytes) {
        code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
      }
      const existing = await client.boxCode.findUnique({ where: { code } })
      if (!existing) {
        return code
      }
    }
    throw new BadRequestException('盒码生成失败，请重试')
  }
}
