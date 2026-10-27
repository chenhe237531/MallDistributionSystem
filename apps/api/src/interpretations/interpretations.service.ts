import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import {
  InterpretationStatus as PrismaInterpretationStatus,
  Prisma,
  Report,
} from '@prisma/client'
import {
  INTERPRETATION_SECTION_KEYS,
  Role,
  type InterpretationSections,
} from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { asStringArray } from '../prisma/array-values'
import { PrismaService } from '../prisma/prisma.service'
import { MockAiAdapter } from './ai.adapter'
import {
  AnnotateInterpretationDto,
  CreateNutritionPlanDto,
  EditInterpretationDto,
  RejectInterpretationDto,
} from './dto/interpretation.dto'
import type { AuthUser } from '../auth/auth-user.type'

const SENSITIVE_WORDS = ['诊断', '治愈', '疗效', '处方药', '替代药物']
const AI_DISCLAIMER = '本解读由 AI 生成，仅用于健康风险提示，不作为临床诊断依据。'

type Access = { full: boolean; channelSide: boolean }

@Injectable()
export class InterpretationsService {
  private readonly logger = new Logger(InterpretationsService.name)
  private readonly adapter = new MockAiAdapter()

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async generateForReport(reportId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } })
    if (!report) {
      throw new NotFoundException('报告不存在')
    }
    if (report.status !== 'published') {
      throw new BadRequestException('只有已发布报告可以生成解读')
    }

    const latest = await this.prisma.interpretation.findFirst({
      where: { reportId },
      orderBy: { version: 'desc' },
    })
    const version = (latest?.version ?? 0) + 1

    try {
      const output = await this.adapter.generate({
        reportNo: report.reportNo,
        fields: report.fields as Record<string, unknown>,
        summary: report.summary,
      })
      const hits = findSensitiveWords(output.sections)
      return this.prisma.interpretation.create({
        data: {
          reportId,
          version,
          status: hits.length
            ? PrismaInterpretationStatus.blocked
            : PrismaInterpretationStatus.generated,
          sections: output.sections as unknown as Prisma.InputJsonValue,
          aiRawOutput: output.rawOutput,
          promptVersion: output.promptVersion,
          modelVersion: output.modelVersion,
          sensitiveHits: hits,
        },
      })
    } catch (error) {
      this.logger.warn(`AI 解读生成失败：${String(error)}`)
      return this.prisma.interpretation.create({
        data: {
          reportId,
          version,
          status: PrismaInterpretationStatus.failed,
          aiRawOutput: String(error),
        },
      })
    }
  }

  async latest(reportId: string, actor: AuthUser) {
    const report = await this.getReport(reportId)
    const access = await this.resolveAccess(report, actor)
    const interpretation = await this.prisma.interpretation.findFirst({
      where: { reportId },
      orderBy: { version: 'desc' },
    })
    if (!interpretation) {
      return { reportId, status: 'missing', contentHidden: true }
    }
    return this.toView(interpretation, access, actor)
  }

  async getOne(id: string, actor: AuthUser) {
    const interpretation = await this.prisma.interpretation.findUnique({ where: { id } })
    if (!interpretation) {
      throw new NotFoundException('解读不存在')
    }
    const report = await this.getReport(interpretation.reportId)
    const access = await this.resolveAccess(report, actor)
    return this.toView(interpretation, access, actor)
  }

  async adopt(id: string, actor: AuthUser) {
    const interpretation = await this.getWritable(id, actor)
    if (interpretation.status === PrismaInterpretationStatus.published) {
      throw new BadRequestException('解读已发布，如需修改请重新生成新版本')
    }
    if (interpretation.status === PrismaInterpretationStatus.blocked) {
      throw new BadRequestException('命中敏感表述，需修改后才能复核通过')
    }
    if (interpretation.status === PrismaInterpretationStatus.failed) {
      throw new BadRequestException('AI 解读生成失败，请重试')
    }
    return this.prisma.interpretation.update({
      where: { id },
      data: {
        status: PrismaInterpretationStatus.reviewed,
        reviewedBy: actor.sub,
        reviewedAt: new Date(),
        reviewDiff: { action: 'adopt' },
      },
    })
  }

  async edit(id: string, dto: EditInterpretationDto, actor: AuthUser) {
    const interpretation = await this.getWritable(id, actor)
    if (interpretation.status === PrismaInterpretationStatus.published) {
      throw new BadRequestException('解读已发布，如需修改请重新生成新版本')
    }
    validateSections(dto.sections)
    const hits = findSensitiveWords(dto.sections)
    const status = hits.length
      ? PrismaInterpretationStatus.blocked
      : PrismaInterpretationStatus.reviewed
    return this.prisma.interpretation.update({
      where: { id },
      data: {
        sections: dto.sections as unknown as Prisma.InputJsonValue,
        status,
        sensitiveHits: hits,
        reviewedBy: actor.sub,
        reviewedAt: new Date(),
        reviewDiff: {
          action: 'edit',
          before: interpretation.sections,
          after: dto.sections,
          note: dto.note,
        } as unknown as Prisma.InputJsonValue,
      },
    })
  }

  async annotate(id: string, dto: AnnotateInterpretationDto, actor: AuthUser) {
    await this.getWritable(id, actor)
    return this.prisma.interpretation.update({
      where: { id },
      data: {
        reviewNote: dto.note,
        reviewedBy: actor.sub,
        reviewedAt: new Date(),
      },
    })
  }

  async reject(id: string, dto: RejectInterpretationDto, actor: AuthUser) {
    const interpretation = await this.getWritable(id, actor)
    if (interpretation.status === PrismaInterpretationStatus.published) {
      throw new BadRequestException('解读已发布，不可驳回')
    }
    return this.prisma.interpretation.update({
      where: { id },
      data: {
        status: PrismaInterpretationStatus.rejected,
        reviewNote: dto.reason,
        reviewedBy: actor.sub,
        reviewedAt: new Date(),
        reviewDiff: { action: 'reject', reason: dto.reason },
      },
    })
  }

  async publish(id: string, actor: AuthUser) {
    const interpretation = await this.getWritable(id, actor)
    if (interpretation.status !== PrismaInterpretationStatus.reviewed) {
      throw new BadRequestException('只有已复核的解读可以发布')
    }
    const published = await this.prisma.interpretation.update({
      where: { id },
      data: { status: PrismaInterpretationStatus.published, publishedAt: new Date() },
    })
    await this.notificationsService.notifyReportReady(interpretation.reportId)
    const report = await this.prisma.report.findUnique({
      where: { id: interpretation.reportId },
      select: {
        id: true,
        reportNo: true,
        orderId: true,
        customerId: true,
        merchantId: true,
        channelId: true,
      },
    })
    const linkedOrder = report?.orderId
      ? await this.prisma.salesOrder.findUnique({
          where: { id: report.orderId },
          select: { orderNo: true },
        })
      : null
    await this.auditService.record({
      actor,
      action: 'interpretation.publish',
      resourceType: 'interpretation',
      resourceId: interpretation.id,
      orderId: report?.orderId ?? null,
      orderNo: linkedOrder?.orderNo ?? null,
      customerId: report?.customerId ?? null,
      channelId: report?.channelId ?? null,
      merchantId: report?.merchantId ?? null,
      detail: { reportNo: report?.reportNo, version: interpretation.version },
    })
    if (report) {
      await this.notificationsService.emit({
        type: 'interpretation_published',
        recipientId: report.customerId,
        recipientRole: Role.CUSTOMER,
        subjectType: 'report',
        subjectId: report.id,
        title: '解读已发布',
        body: '您的报告解读已发布，登录后可查看。',
        templateCode: 'interpretation_published',
        dedupeKey: `interpretation_published:${interpretation.id}`,
        payload: { reportId: report.id },
      })
    }
    return published
  }

  async createNutritionPlan(dto: CreateNutritionPlanDto, actor: AuthUser) {
    if (!actor.roles.includes(Role.NUTRITIONIST) && !actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('只有营养师或平台可以出具营养方案')
    }
    const report = await this.getReport(dto.reportId)
    if (dto.interpretationId) {
      const interpretation = await this.prisma.interpretation.findUnique({
        where: { id: dto.interpretationId },
      })
      if (!interpretation || interpretation.reportId !== report.id) {
        throw new BadRequestException('解读与报告不匹配')
      }
    }
    return this.prisma.nutritionPlan.create({
      data: {
        reportId: report.id,
        interpretationId: dto.interpretationId,
        customerId: report.customerId,
        nutritionistId: actor.sub,
        cycle: dto.cycle,
        meals: dto.meals as Prisma.InputJsonValue,
        followUpNodes: dto.followUpNodes as Prisma.InputJsonValue,
      },
    })
  }

  async publishNutritionPlan(id: string, actor: AuthUser) {
    if (!actor.roles.includes(Role.NUTRITIONIST) && !actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('只有营养师或平台可以发布营养方案')
    }
    const plan = await this.prisma.nutritionPlan.findUnique({ where: { id } })
    if (!plan) {
      throw new NotFoundException('营养方案不存在')
    }
    return this.prisma.nutritionPlan.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
    })
  }

  async nutritionPlansByReport(reportId: string, actor: AuthUser) {
    const report = await this.getReport(reportId)
    const access = await this.resolveAccess(report, actor)
    if (!access.full) {
      throw new ForbiddenException('C 端已关闭报告授权')
    }
    const isCustomer = actor.roles.includes(Role.CUSTOMER)
    return this.prisma.nutritionPlan.findMany({
      where: {
        reportId,
        ...(isCustomer ? { status: 'published' } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async myNutritionPlans(customerId: string) {
    return this.prisma.nutritionPlan.findMany({
      where: { customerId, status: 'published' },
      orderBy: { createdAt: 'desc' },
    })
  }

  async nutritionPlan(id: string, actor: AuthUser) {
    const plan = await this.prisma.nutritionPlan.findUnique({ where: { id } })
    if (!plan) {
      throw new NotFoundException('营养方案不存在')
    }
    if (
      !actor.roles.includes(Role.PLATFORM) &&
      !actor.roles.includes(Role.NUTRITIONIST) &&
      plan.customerId !== actor.sub
    ) {
      const report = await this.getReport(plan.reportId)
      const access = await this.resolveAccess(report, actor)
      if (!access.full) {
        throw new ForbiddenException('无权查看该营养方案')
      }
    }
    if (plan.customerId === actor.sub && plan.status !== 'published') {
      throw new NotFoundException('营养方案尚未发布')
    }
    return plan
  }

  private async getWritable(id: string, actor: AuthUser) {
    if (!actor.roles.includes(Role.NUTRITIONIST) && !actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('只有营养师或平台可以操作解读')
    }
    const interpretation = await this.prisma.interpretation.findUnique({ where: { id } })
    if (!interpretation) {
      throw new NotFoundException('解读不存在')
    }
    return interpretation
  }

  private async getReport(reportId: string): Promise<Report> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } })
    if (!report) {
      throw new NotFoundException('报告不存在')
    }
    return report
  }

  private async resolveAccess(report: Report, actor: AuthUser): Promise<Access> {
    if (
      actor.roles.includes(Role.PLATFORM) ||
      actor.roles.includes(Role.NUTRITIONIST)
    ) {
      return { full: true, channelSide: false }
    }
    let allowed = false
    let channelSide = false

    if (actor.roles.includes(Role.CUSTOMER) && report.customerId === actor.sub) {
      allowed = true
    } else if (actor.roles.includes(Role.LAB) && report.labUserId === actor.sub) {
      allowed = true
    } else if (actor.roles.includes(Role.MERCHANT) && report.merchantId === actor.sub) {
      allowed = true
      channelSide = true
    } else if (actor.roles.includes(Role.PARTNER)) {
      const channel = await this.prisma.channelIdentity.findFirst({
        where: { id: report.channelId, userId: actor.sub, status: 'active' },
      })
      if (channel) {
        allowed = true
        channelSide = true
      }
    } else if (actor.roles.includes(Role.SALES) && report.orderId) {
      const order = await this.prisma.salesOrder.findUnique({
        where: { id: report.orderId },
        select: { attributedSalesId: true },
      })
      if (order?.attributedSalesId === actor.sub) {
        allowed = true
        channelSide = true
      }
    }

    if (!allowed) {
      await this.prisma.systemAlert.create({
        data: {
          type: 'interpretation_access_denied',
          subjectType: 'report',
          subjectId: report.id,
          message: `用户 ${actor.phone}（${actor.role}）尝试访问非归属解读`,
          severity: 'warning',
        },
      })
      throw new ForbiddenException('无权查看该解读')
    }

    let full = true
    if (channelSide) {
      const consent = await this.prisma.consentRecord.findFirst({
        where: { customerId: report.customerId },
        orderBy: { agreedAt: 'desc' },
      })
      full = consent?.reportAuthorization !== false
    }
    return { full, channelSide }
  }

  private toView(
    interpretation: {
      id: string
      reportId: string
      version: number
      status: string
      sections: unknown
      sensitiveHits: unknown
      reviewNote: string | null
      reviewedBy: string | null
      reviewedAt: Date | null
      publishedAt: Date | null
      modelVersion: string
      promptVersion: string
      createdAt: Date
    },
    access: Access,
    actor: AuthUser,
  ) {
    const isReviewer = actor.roles.includes(Role.NUTRITIONIST) || actor.roles.includes(Role.PLATFORM)
    const visible =
      isReviewer ||
      actor.roles.includes(Role.LAB) ||
      (['reviewed', 'published'].includes(interpretation.status) &&
        Boolean(interpretation.publishedAt))

    if (!access.full || !visible) {
      return {
        id: interpretation.id,
        reportId: interpretation.reportId,
        version: interpretation.version,
        status: interpretation.status,
        contentHidden: true,
        generatedAt: interpretation.createdAt,
        reviewedAt: interpretation.reviewedAt,
        reviewed: Boolean(interpretation.reviewedBy),
        disclaimer: AI_DISCLAIMER,
      }
    }

    return {
      id: interpretation.id,
      reportId: interpretation.reportId,
      version: interpretation.version,
      status: interpretation.status,
      sections: interpretation.sections,
      aiGenerated: true,
      reviewed: Boolean(interpretation.reviewedBy),
      reviewedBy: interpretation.reviewedBy,
      reviewedAt: interpretation.reviewedAt,
      publishedAt: interpretation.publishedAt,
      modelVersion: interpretation.modelVersion,
      promptVersion: interpretation.promptVersion,
      sensitiveHits: isReviewer ? asStringArray(interpretation.sensitiveHits) : undefined,
      reviewNote: isReviewer ? interpretation.reviewNote : undefined,
      contentHidden: false,
      disclaimer: AI_DISCLAIMER,
    }
  }
}

function findSensitiveWords(sections: InterpretationSections): string[] {
  const text = INTERPRETATION_SECTION_KEYS.filter((key) => key !== 'disclaimer')
    .map((key) => sections[key])
    .join('\n')
  return SENSITIVE_WORDS.filter((word) => text.includes(word))
}

function validateSections(sections: InterpretationSections): void {
  for (const key of INTERPRETATION_SECTION_KEYS) {
    if (typeof sections[key] !== 'string') {
      throw new BadRequestException(`解读缺少字段：${key}`)
    }
  }
}
