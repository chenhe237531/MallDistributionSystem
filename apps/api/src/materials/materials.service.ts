import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Role } from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreateMaterialTemplateDto,
  GenerateMaterialDto,
} from './dto/material.dto'
import type { AuthUser } from '../auth/auth-user.type'

const VIOLATION_WORDS = ['治愈', '疗效', '诊断', '处方药', '包治', '百分百']

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createTemplate(dto: CreateMaterialTemplateDto, actor: AuthUser) {
    if (!actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('只有平台可以维护素材模板')
    }
    const existing = await this.prisma.materialTemplate.findUnique({ where: { code: dto.code } })
    if (existing) {
      throw new BadRequestException('模板编码已存在')
    }
    return this.prisma.materialTemplate.create({
      data: {
        code: dto.code,
        name: dto.name,
        category: dto.category,
        contentType: dto.contentType,
        body: dto.body,
        lockedClauses: dto.lockedClauses ?? [],
        applicableProductIds: dto.applicableProductIds ?? [],
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      },
    })
  }

  async listTemplates(actor: AuthUser, includeInactive = false) {
    const canSeeInactive = includeInactive && actor.roles.includes(Role.PLATFORM)
    return this.prisma.materialTemplate.findMany({
      where: canSeeInactive ? {} : { active: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async setTemplateStatus(id: string, active: boolean) {
    const template = await this.prisma.materialTemplate.findUnique({ where: { id } })
    if (!template) {
      throw new NotFoundException('模板不存在')
    }
    return this.prisma.materialTemplate.update({
      where: { id },
      data: { active },
    })
  }

  async generate(actor: AuthUser, dto: GenerateMaterialDto) {
    if (!actor.roles.includes(Role.MERCHANT)) {
      throw new ForbiddenException('只有商家可以生成素材')
    }
    const merchant = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      include: { organization: true },
    })
    if (!merchant) {
      throw new NotFoundException('商家账号不存在')
    }
    const template = await this.prisma.materialTemplate.findUnique({
      where: { id: dto.templateId },
    })
    if (!template || !template.active) {
      throw new BadRequestException('素材模板不存在或已下架')
    }
    if (template.validUntil && template.validUntil < new Date()) {
      throw new BadRequestException('素材模板已过有效期')
    }

    if (template.applicableProductIds.length > 0) {
      if (!dto.productId || !template.applicableProductIds.includes(dto.productId)) {
        throw new BadRequestException('该模板不适用于所选商品')
      }
    }
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.productId } })
      if (!product || product.status !== 'active') {
        throw new BadRequestException('商品未上架，不能生成素材')
      }
      const listing = await this.prisma.merchantProduct.findUnique({
        where: {
          merchantId_productId: { merchantId: actor.sub, productId: dto.productId },
        },
      })
      if (!listing || listing.status !== 'active') {
        throw new BadRequestException('商品未在本店上架，不能生成素材')
      }
    }

    let channel = await this.prisma.channelIdentity.findFirst({
      where: { userId: actor.sub, type: 'merchant', status: 'active' },
    })
    const channelReplaced = false
    if (!channel) {
      throw new BadRequestException('商家渠道身份不可用，无法生成素材')
    }

    const storeName = dto.storeName ?? merchant.organization?.name ?? merchant.name
    const storeAddress = dto.storeAddress ?? ''
    const qrPayload = `${process.env.PUBLIC_BASE_URL ?? 'https://mall.example'}/store?channel=${channel.code}`
    const replacements: Record<string, string> = {
      '{{merchantName}}': merchant.organization?.name ?? merchant.name,
      '{{storeName}}': storeName,
      '{{storeAddress}}': storeAddress,
      '{{channelCode}}': channel.code,
      '{{contact}}': merchant.phone,
    }
    let body = template.body
    for (const [key, value] of Object.entries(replacements)) {
      body = body.split(key).join(value)
    }
    const custom = dto.note ? `\n\n${dto.note}` : ''
    const violation = findViolation(`${body}${custom}`)
    if (violation) {
      throw new BadRequestException(
        `违规词「${violation.word}」出现在：${violation.snippet}`,
      )
    }

    const lockedClauses = template.lockedClauses.length
      ? `\n\n【平台锁定条款】\n${template.lockedClauses.join('\n')}`
      : ''
    const content = `${body}${custom}${lockedClauses}\n\n渠道码：${channel.code}\n二维码：${qrPayload}`

    const material = await this.prisma.material.create({
      data: {
        templateId: template.id,
        merchantId: actor.sub,
        channelId: channel.id,
        channelCode: channel.code,
        productId: dto.productId,
        title: `${template.name} · ${storeName}`,
        content,
        qrPayload,
        generatedBy: actor.sub,
        channelReplaced,
      },
      include: { template: true },
    })
    await this.auditService.record({
      actor,
      action: 'material.generate',
      resourceType: 'material',
      resourceId: material.id,
      channelId: channel.id,
      merchantId: actor.sub,
      detail: {
        templateCode: template.code,
        title: material.title,
        productId: material.productId,
      },
    })
    return material
  }

  async listMine(merchantId: string) {
    return this.prisma.material.findMany({
      where: { merchantId },
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getOne(id: string, actor: AuthUser) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: { template: true },
    })
    if (!material) {
      throw new NotFoundException('素材不存在')
    }
    if (!actor.roles.includes(Role.PLATFORM) && material.merchantId !== actor.sub) {
      throw new ForbiddenException('无权查看该素材')
    }
    return material
  }
}

function findViolation(text: string): { word: string; snippet: string } | null {
  for (const word of VIOLATION_WORDS) {
    const index = text.indexOf(word)
    if (index >= 0) {
      return {
        word,
        snippet: text.slice(Math.max(0, index - 10), index + word.length + 10),
      }
    }
  }
  return null
}
