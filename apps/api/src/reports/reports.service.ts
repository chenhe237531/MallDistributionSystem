import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import {
  Prisma,
  Report,
  ReportStatus as PrismaReportStatus,
  Role as PrismaRole,
  SampleStatus,
} from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { Role } from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { InterpretationsService } from '../interpretations/interpretations.service'
import { NotificationsService } from '../notifications/notifications.service'
import { PrismaService } from '../prisma/prisma.service'
import { CorrectReportDto, CreateReportDto } from './dto/report.dto'
import type { AuthUser } from '../auth/auth-user.type'

export const REPORT_DISCLAIMER = '本报告仅用于健康风险提示，不作为临床诊断依据'

type AccessResult = { allowed: boolean; channelSide: boolean; redacted: boolean }

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly interpretationsService: InterpretationsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async create(actor: AuthUser, dto: CreateReportDto) {
    if (!actor.roles.includes(Role.LAB) && !actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('只有实验室或平台可以创建报告')
    }
    const sample = await this.prisma.sample.findUnique({ where: { id: dto.sampleId } })
    if (!sample) {
      throw new NotFoundException('样本不存在')
    }
    if (
      sample.status !== SampleStatus.testing &&
      sample.status !== SampleStatus.report_generated
    ) {
      throw new BadRequestException('样本未进入检测或报告阶段')
    }
    const existing = await this.prisma.report.count({ where: { sampleId: sample.id } })
    if (existing > 0) {
      throw new BadRequestException('该样本已有报告，如需修改请使用更正流程')
    }

    return this.prisma.report.create({
      data: {
        reportNo: this.generateReportNo(),
        sampleId: sample.id,
        orderId: sample.orderId,
        customerId: sample.customerId,
        merchantId: sample.merchantId,
        channelId: sample.channelId,
        labUserId: actor.sub,
        fields: dto.fields as Prisma.InputJsonValue,
        summary: dto.summary,
        missingItems: dto.missingItems ?? [],
        pdfUrl: dto.pdfUrl,
        status: PrismaReportStatus.draft,
      },
      include: { sample: true },
    })
  }

  async submit(id: string, actor: AuthUser) {
    if (!actor.roles.includes(Role.LAB) && !actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('只有实验室或平台可以提交报告审核')
    }
    const report = await this.prisma.report.findUnique({ where: { id } })
    if (!report) {
      throw new NotFoundException('报告不存在')
    }
    if (report.status !== PrismaReportStatus.draft) {
      throw new BadRequestException('只有草稿报告可以提交审核')
    }
    return this.prisma.report.update({
      where: { id },
      data: { status: PrismaReportStatus.pending_review },
    })
  }

  async publish(id: string, actor: AuthUser) {
    if (!actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('只有平台可以审核发布报告')
    }
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { sample: true },
    })
    if (!report) {
      throw new NotFoundException('报告不存在')
    }
    if (report.status !== PrismaReportStatus.pending_review) {
      throw new BadRequestException('只有待审核报告可以发布')
    }

    const published = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.report.update({
        where: { id },
        data: {
          status: PrismaReportStatus.published,
          reviewerId: actor.sub,
          publishedAt: new Date(),
        },
        include: { sample: true },
      })
      await tx.sample.update({
        where: { id: report.sampleId },
        data: { status: SampleStatus.published },
      })
      await tx.sampleEvent.create({
        data: { sampleId: report.sampleId, type: 'report_published', operatorId: actor.sub },
      })
      if (report.orderId) {
        await tx.salesOrder.updateMany({
          where: { id: report.orderId },
          data: { status: 'report_ready' },
        })
      }
      await tx.report.updateMany({
        where: {
          reportNo: report.reportNo,
          id: { not: report.id },
          status: { not: PrismaReportStatus.archived },
        },
        data: { status: PrismaReportStatus.archived },
      })
      return updated
    })

    const order = report.orderId
      ? await this.prisma.salesOrder.findUnique({ where: { id: report.orderId } })
      : null
    await this.auditService.record({
      actor,
      action: 'report.publish',
      resourceType: 'report',
      resourceId: report.id,
      orderId: report.orderId,
      orderNo: order?.orderNo ?? null,
      customerId: report.customerId,
      channelId: report.channelId,
      merchantId: report.merchantId,
      detail: { reportNo: report.reportNo, version: report.version },
    })
    try {
      await this.interpretationsService.generateForReport(report.id)
      await this.notificationsService.notifyReportReady(report.id)
    } catch (error) {
      this.logger.warn(`报告发布后生成解读或通知失败：${String(error)}`)
    }
    return published
  }

  async correct(id: string, dto: CorrectReportDto, actor: AuthUser) {
    if (!actor.roles.includes(Role.LAB) && !actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('只有实验室或平台可以更正报告')
    }
    const original = await this.prisma.report.findUnique({ where: { id } })
    if (!original) {
      throw new NotFoundException('报告不存在')
    }
    if (
      original.status !== PrismaReportStatus.published &&
      original.status !== PrismaReportStatus.corrected
    ) {
      throw new BadRequestException('只有已发布报告可以更正')
    }
    const latest = await this.prisma.report.findFirst({
      where: { reportNo: original.reportNo },
      orderBy: { version: 'desc' },
    })
    const nextVersion = (latest?.version ?? original.version) + 1

    return this.prisma.report.create({
      data: {
        reportNo: original.reportNo,
        version: nextVersion,
        sampleId: original.sampleId,
        orderId: original.orderId,
        customerId: original.customerId,
        merchantId: original.merchantId,
        channelId: original.channelId,
        labUserId: original.labUserId,
        fields: dto.fields as Prisma.InputJsonValue,
        summary: dto.summary,
        missingItems: dto.missingItems ?? [],
        pdfUrl: dto.pdfUrl,
        status: PrismaReportStatus.pending_review,
      },
      include: { sample: true },
    })
  }

  async list(actor: AuthUser) {
    const where = await this.listWhere(actor)
    return this.prisma.report.findMany({
      where,
      include: {
        sample: { include: { boxCode: true } },
      },
      orderBy: [{ reportNo: 'desc' }, { version: 'desc' }],
    })
  }

  async latestBySample(sampleId: string, actor: AuthUser) {
    const report = await this.prisma.report.findFirst({
      where: { sampleId },
      orderBy: { version: 'desc' },
    })
    if (!report) {
      throw new NotFoundException('该样本暂无报告')
    }
    return this.getOne(report.id, actor)
  }

  async getOne(id: string, actor: AuthUser) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { sample: { include: { boxCode: true } }, views: false },
    })
    if (!report) {
      throw new NotFoundException('报告不存在')
    }
    const access = await this.resolveAccess(report, actor)
    await this.recordView(report, actor, 'view')
    const recentViews = await this.prisma.reportView.count({
      where: {
        reportId: report.id,
        viewerId: actor.sub,
        viewedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    })
    if (recentViews > 5) {
      const existing = await this.prisma.systemAlert.findFirst({
        where: {
          type: 'report_high_frequency_view',
          subjectId: report.id,
          message: { contains: actor.phone },
          status: 'open',
        },
      })
      if (!existing) {
        await this.prisma.systemAlert.create({
          data: {
            type: 'report_high_frequency_view',
            subjectType: 'report',
            subjectId: report.id,
            message: `用户 ${actor.phone}（${actor.role}）1 小时内查看报告 ${report.reportNo} 达 ${recentViews} 次，触发外传风险告警`,
            severity: 'warning',
          },
        })
      }
    }
    await this.auditService.record({
      actor,
      action: 'report.view',
      resourceType: 'report',
      resourceId: report.id,
      orderId: report.orderId,
      customerId: report.customerId,
      channelId: report.channelId,
      merchantId: report.merchantId,
      detail: { reportNo: report.reportNo, version: report.version, redacted: access.redacted },
    })

    if (access.redacted) {
      return {
        id: report.id,
        reportNo: report.reportNo,
        version: report.version,
        status: report.status,
        sampleId: report.sampleId,
        publishedAt: report.publishedAt,
        missingItems: report.missingItems,
        contentHidden: true,
        disclaimer: REPORT_DISCLAIMER,
      }
    }

    return {
      ...report,
      contentHidden: false,
      disclaimer: REPORT_DISCLAIMER,
      watermark: access.channelSide
        ? `${actor.role} ${actor.phone} · ${new Date().toISOString()}`
        : undefined,
    }
  }

  async download(id: string, actor: AuthUser) {
    const report = await this.prisma.report.findUnique({ where: { id } })
    if (!report) {
      throw new NotFoundException('报告不存在')
    }
    const access = await this.resolveAccess(report, actor)
    if (access.redacted) {
      throw new ForbiddenException('C 端已关闭报告授权，无法下载')
    }
    if (!report.pdfUrl) {
      throw new BadRequestException('报告文件尚未生成')
    }
    await this.recordView(report, actor, 'download')
    await this.auditService.record({
      actor,
      action: 'report.download',
      resourceType: 'report',
      resourceId: report.id,
      orderId: report.orderId,
      customerId: report.customerId,
      channelId: report.channelId,
      merchantId: report.merchantId,
      detail: { reportNo: report.reportNo, version: report.version },
    })
    return {
      url: report.pdfUrl,
      reportNo: report.reportNo,
      version: report.version,
      disclaimer: REPORT_DISCLAIMER,
      watermark: access.channelSide
        ? `${actor.role} ${actor.phone} · ${new Date().toISOString()}`
        : undefined,
    }
  }

  async views(id: string, actor: AuthUser) {
    const report = await this.prisma.report.findUnique({ where: { id } })
    if (!report) {
      throw new NotFoundException('报告不存在')
    }
    await this.resolveAccess(report, actor)
    return this.prisma.reportView.findMany({
      where: { reportId: id },
      orderBy: { viewedAt: 'desc' },
    })
  }

  async myViews(customerId: string) {
    return this.prisma.reportView.findMany({
      where: { report: { customerId } },
      include: {
        report: { select: { id: true, reportNo: true, version: true, sampleId: true } },
      },
      orderBy: { viewedAt: 'desc' },
    })
  }

  private async resolveAccess(report: Report, actor: AuthUser): Promise<AccessResult> {
    if (actor.roles.includes(Role.PLATFORM)) {
      return { allowed: true, channelSide: false, redacted: false }
    }

    let allowed = false
    let channelSide = false

    if (actor.roles.includes(Role.CUSTOMER) && report.customerId === actor.sub) {
      allowed = true
    } else if (actor.roles.includes(Role.MERCHANT) && report.merchantId === actor.sub) {
      allowed = true
      channelSide = true
    } else if (actor.roles.includes(Role.LAB) && report.labUserId === actor.sub) {
      allowed = true
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
          type: 'report_access_denied',
          subjectType: 'report',
          subjectId: report.id,
          message: `用户 ${actor.phone}（${actor.role}）尝试访问非归属报告`,
          severity: 'warning',
        },
      })
      await this.auditService.record({
        actor,
        action: 'report.access_denied',
        resourceType: 'report',
        resourceId: report.id,
        orderId: report.orderId,
        customerId: report.customerId,
        merchantId: report.merchantId,
        detail: { reportNo: report.reportNo },
      })
      throw new ForbiddenException('无权查看该报告')
    }

    let redacted = false
    if (channelSide) {
      const consent = await this.prisma.consentRecord.findFirst({
        where: { customerId: report.customerId },
        orderBy: { agreedAt: 'desc' },
      })
      redacted = consent?.reportAuthorization === false
    }
    return { allowed, channelSide, redacted }
  }

  private async recordView(report: Report, actor: AuthUser, action: 'view' | 'download') {
    await this.prisma.reportView.create({
      data: {
        reportId: report.id,
        viewerId: actor.sub,
        role: actor.role as unknown as PrismaRole,
        action,
        version: report.version,
      },
    })
  }

  private async listWhere(actor: AuthUser): Promise<Prisma.ReportWhereInput> {
    if (actor.roles.includes(Role.PLATFORM)) {
      return {}
    }
    if (actor.roles.includes(Role.CUSTOMER)) {
      return { customerId: actor.sub }
    }
    if (actor.roles.includes(Role.MERCHANT)) {
      return { merchantId: actor.sub }
    }
    if (actor.roles.includes(Role.LAB)) {
      return { labUserId: actor.sub }
    }
    if (actor.roles.includes(Role.PARTNER)) {
      const channels = await this.prisma.channelIdentity.findMany({
        where: { userId: actor.sub },
        select: { id: true },
      })
      return { channelId: { in: channels.map((channel) => channel.id) } }
    }
    if (actor.roles.includes(Role.SALES)) {
      const orders = await this.prisma.salesOrder.findMany({
        where: { attributedSalesId: actor.sub },
        select: { id: true },
      })
      return { orderId: { in: orders.map((order) => order.id) } }
    }
    return { id: '__none__' }
  }

  private generateReportNo(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return `BG${date}${randomBytes(3).toString('hex').toUpperCase()}`
  }
}
