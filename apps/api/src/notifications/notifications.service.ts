import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { Role } from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import { ForwardReportDto } from './dto/notification.dto'
import type { AuthUser } from '../auth/auth-user.type'

const SUBSCRIPTION_CONFIG_KEY = 'notify.subscription.enabled'
const FORWARD_DUE_HOURS = 24
const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const TEMPLATE_CODE = 'report_ready'
const TEMPLATE_VERSION = 1

type ReportWithContext = {
  id: string
  reportNo: string
  status: string
  orderId: string | null
  customerId: string
  merchantId: string
  channelId: string
  publishedAt: Date | null
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async notifyReportReady(reportId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } })
    if (!report || report.status !== 'published') {
      return null
    }
    const interpretation = await this.prisma.interpretation.findFirst({
      where: { reportId },
      orderBy: { version: 'desc' },
    })
    if (
      !interpretation ||
      !['generated', 'reviewed', 'published'].includes(interpretation.status) ||
      !interpretation.sections
    ) {
      return null
    }

    const dueAt = new Date(
      (report.publishedAt ?? new Date()).getTime() + FORWARD_DUE_HOURS * 60 * 60 * 1000,
    )
    await this.prisma.reminder.upsert({
      where: {
        type_subjectId_dueAt: {
          type: 'report_forward',
          subjectId: report.id,
          dueAt,
        },
      },
      update: {},
      create: { type: 'report_forward', subjectId: report.id, dueAt },
    })

    const dedupeKey = `report_ready:${report.id}`
    const existing = await this.prisma.notification.findUnique({ where: { dedupeKey } })
    if (existing) {
      return existing
    }

    const subscriptionAvailable = await this.isSubscriptionAvailable()
    return this.prisma.notification.create({
      data: {
        type: 'report_ready',
        recipientId: report.merchantId,
        recipientRole: Role.MERCHANT,
        subjectType: 'report',
        subjectId: report.id,
        title: '报告已生成',
        body: '您有一份新的检测报告已生成，点击进入查看。',
        channel: subscriptionAvailable ? 'subscription' : 'in_app',
        status: 'sent',
        templateCode: TEMPLATE_CODE,
        templateVersion: TEMPLATE_VERSION,
        dedupeKey,
        failureReason: subscriptionAvailable ? null : '订阅消息不可用，已使用站内消息兜底',
        sentAt: new Date(),
        payload: {
          reportId: report.id,
          orderId: report.orderId,
          entry: `/reports/${report.id}`,
        },
      },
    })
  }

  async emit(input: {
    type: string
    recipientId: string
    recipientRole: Role
    subjectType: string
    subjectId: string
    title: string
    body: string
    templateCode: string
    templateVersion?: number
    channel?: 'in_app' | 'subscription'
    dedupeKey?: string
    payload?: Record<string, unknown>
  }) {
    const channel = input.channel ?? 'in_app'
    return this.prisma.notification.create({
      data: {
        type: input.type,
        recipientId: input.recipientId,
        recipientRole: input.recipientRole,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        title: input.title,
        body: input.body,
        channel,
        status: 'sent',
        templateCode: input.templateCode,
        templateVersion: input.templateVersion ?? 1,
        dedupeKey: input.dedupeKey,
        payload: input.payload ? (input.payload as Prisma.InputJsonValue) : undefined,
        sentAt: new Date(),
      },
    })
  }

  async listMine(actor: AuthUser) {
    const items = await this.prisma.notification.findMany({
      where: { recipientId: actor.sub },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return {
      unread: items.filter((item) => item.status !== 'read').length,
      items,
    }
  }

  async markRead(id: string, actor: AuthUser) {
    const notification = await this.prisma.notification.findUnique({ where: { id } })
    if (!notification) {
      throw new NotFoundException('通知不存在')
    }
    if (notification.recipientId !== actor.sub) {
      throw new ForbiddenException('无权操作该通知')
    }
    if (notification.status === 'read') {
      return notification
    }
    return this.prisma.notification.update({
      where: { id },
      data: { status: 'read', readAt: new Date() },
    })
  }

  async reportTasks(actor: AuthUser) {
    const reminders = await this.prisma.reminder.findMany({
      where: { type: 'report_forward', status: 'pending' },
      orderBy: { dueAt: 'asc' },
    })
    if (reminders.length === 0) {
      return []
    }
    const reports = await this.prisma.report.findMany({
      where: { id: { in: reminders.map((reminder) => reminder.subjectId) } },
    })
    const visible = actor.roles.includes(Role.PLATFORM)
      ? reports
      : reports.filter((report) => report.merchantId === actor.sub)
    if (visible.length === 0) {
      return []
    }

    const merchantIds = Array.from(new Set(visible.map((report) => report.merchantId)))
    const merchants = await this.prisma.user.findMany({
      where: { id: { in: merchantIds } },
      include: { organization: true },
    })
    const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]))
    const now = new Date()

    const groups = new Map<string, {
      merchantId: string
      merchantName: string
      pendingCount: number
      overdueCount: number
      tasks: Array<{
        reportId: string
        reportNo: string
        orderId: string | null
        customerId: string
        dueAt: Date
        overdue: boolean
      }>
    }>()

    for (const report of visible) {
      const reminder = reminders.find((item) => item.subjectId === report.id)
      if (!reminder) {
        continue
      }
      const merchant = merchantById.get(report.merchantId)
      const group = groups.get(report.merchantId) ?? {
        merchantId: report.merchantId,
        merchantName: merchant?.organization?.name ?? merchant?.name ?? report.merchantId,
        pendingCount: 0,
        overdueCount: 0,
        tasks: [],
      }
      const overdue = reminder.dueAt.getTime() < now.getTime()
      group.pendingCount += 1
      if (overdue) {
        group.overdueCount += 1
      }
      group.tasks.push({
        reportId: report.id,
        reportNo: report.reportNo,
        orderId: report.orderId,
        customerId: report.customerId,
        dueAt: reminder.dueAt,
        overdue,
      })
      groups.set(report.merchantId, group)
    }

    return Array.from(groups.values()).sort((a, b) => b.overdueCount - a.overdueCount)
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async scanOverdueTasks(): Promise<{ scanned: number; alertsCreated: number }> {
    return this.scanOverdue()
  }

  async scanOverdue() {
    const now = new Date()
    const reminders = await this.prisma.reminder.findMany({
      where: { type: 'report_forward', status: 'pending', dueAt: { lt: now } },
    })
    let alertsCreated = 0
    for (const reminder of reminders) {
      const existing = await this.prisma.systemAlert.findFirst({
        where: {
          type: 'report_forward_overdue',
          subjectType: 'report',
          subjectId: reminder.subjectId,
          status: 'open',
        },
      })
      if (existing) {
        continue
      }
      const report = await this.prisma.report.findUnique({
        where: { id: reminder.subjectId },
      })
      await this.prisma.systemAlert.create({
        data: {
          type: 'report_forward_overdue',
          subjectType: 'report',
          subjectId: reminder.subjectId,
          message: `报告 ${report?.reportNo ?? reminder.subjectId} 已超过 24 小时未转发给客户，请运营跟进`,
          severity: 'warning',
        },
      })
      alertsCreated += 1
    }
    return { scanned: reminders.length, alertsCreated }
  }

  async forwardReport(reportId: string, dto: ForwardReportDto, actor: AuthUser) {
    if (!actor.roles.includes(Role.MERCHANT)) {
      throw new ForbiddenException('只有商家可以转发报告')
    }
    const report = await this.prisma.report.findUnique({ where: { id: reportId } })
    if (!report) {
      throw new NotFoundException('报告不存在')
    }
    if (report.merchantId !== actor.sub) {
      throw new ForbiddenException('无权转发该报告')
    }
    if (report.status !== 'published') {
      throw new BadRequestException('报告尚未发布，不能转发')
    }

    const customer = await this.prisma.user.findUnique({ where: { id: report.customerId } })
    if (!customer) {
      throw new NotFoundException('报告对应客户不存在')
    }
    if (dto.receiverPhone !== customer.phone) {
      throw new BadRequestException('接收人手机号必须与报告客户一致，第三人无法打开')
    }
    let orderNo: string | null = null
    if (report.orderId) {
      const order = await this.prisma.salesOrder.findUnique({
        where: { id: report.orderId },
        select: { customerId: true, orderNo: true },
      })
      if (!order || order.customerId !== customer.id) {
        throw new BadRequestException('报告与订单归属不一致，不能转发')
      }
      orderNo = order.orderNo
    }

    const share = await this.prisma.reportShare.create({
      data: {
        token: randomBytes(18).toString('hex'),
        reportId: report.id,
        orderId: report.orderId,
        merchantId: report.merchantId,
        forwarderId: actor.sub,
        receiverUserId: customer.id,
        receiverPhone: dto.receiverPhone,
        expiresAt: new Date(Date.now() + SHARE_TTL_MS),
      },
    })

    await this.prisma.notification.create({
      data: {
        type: 'report_shared',
        recipientId: customer.id,
        recipientRole: Role.CUSTOMER,
        subjectType: 'report',
        subjectId: report.id,
        title: '报告已生成',
        body: '您有一份检测报告待查看，请登录后打开。',
        channel: 'in_app',
        status: 'sent',
        templateCode: 'report_shared',
        templateVersion: 1,
        dedupeKey: `report_shared:${share.id}`,
        sentAt: new Date(),
        payload: { reportId: report.id, shareToken: share.token, entry: `/report-shares/${share.token}` },
      },
    })

    await this.prisma.reminder.updateMany({
      where: { type: 'report_forward', subjectId: report.id, status: 'pending' },
      data: { status: 'done' },
    })

    await this.auditService.record({
      actor,
      action: 'report.forward',
      resourceType: 'report',
      resourceId: report.id,
      orderId: report.orderId,
      orderNo,
      customerId: report.customerId,
      channelId: report.channelId,
      merchantId: report.merchantId,
      detail: {
        reportNo: report.reportNo,
        shareId: share.id,
        receiverPhone: dto.receiverPhone,
        receiverName: dto.receiverName,
      },
    })

    return {
      shareId: share.id,
      token: share.token,
      receiverPhone: dto.receiverPhone,
      expiresAt: share.expiresAt,
      entry: `/report-shares/${share.token}`,
    }
  }

  async openShare(token: string, actor: AuthUser) {
    const share = await this.prisma.reportShare.findUnique({ where: { token } })
    if (!share || share.status !== 'active') {
      throw new NotFoundException('分享链接无效')
    }
    if (share.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('分享链接已过期')
    }

    if (actor.phone !== share.receiverPhone) {
      await this.logDeniedShare(share, actor, '手机号不匹配')
      throw new ForbiddenException('仅接收人本人可以打开该报告')
    }
    if (share.receiverUserId && share.receiverUserId !== actor.sub) {
      await this.logDeniedShare(share, actor, '非订单客户')
      throw new ForbiddenException('仅订单客户本人可以打开该报告')
    }

    const report = await this.prisma.report.findUnique({ where: { id: share.reportId } })
    if (!report) {
      throw new NotFoundException('报告不存在')
    }
    if (report.customerId !== actor.sub) {
      await this.logDeniedShare(share, actor, '报告归属校验失败')
      throw new ForbiddenException('仅订单客户本人可以打开该报告')
    }
    if (report.status !== 'published') {
      throw new BadRequestException('报告尚未发布')
    }

    if (!share.openedAt) {
      await this.prisma.reportShare.update({
        where: { id: share.id },
        data: { openedById: actor.sub, openedAt: new Date() },
      })
    }

    await this.prisma.reportView.create({
      data: {
        reportId: report.id,
        viewerId: actor.sub,
        role: actor.role as unknown as Prisma.ReportViewCreateInput['role'],
        action: 'share_open',
        version: report.version,
      },
    })

    await this.auditService.record({
      actor,
      action: 'report.share_open',
      resourceType: 'report',
      resourceId: report.id,
      orderId: report.orderId,
      customerId: report.customerId,
      channelId: report.channelId,
      merchantId: report.merchantId,
      detail: { shareId: share.id, reportNo: report.reportNo },
    })

    return {
      valid: true,
      report: {
        id: report.id,
        reportNo: report.reportNo,
        version: report.version,
        status: report.status,
        publishedAt: report.publishedAt,
        orderId: report.orderId,
      },
      entry: `/reports/${report.id}`,
    }
  }

  async shareDetail(token: string, actor: AuthUser) {
    return this.openShare(token, actor)
  }

  private async logDeniedShare(
    share: { id: string; reportId: string; merchantId: string; forwarderId: string },
    actor: AuthUser,
    reason: string,
  ) {
    await this.prisma.systemAlert.create({
      data: {
        type: 'report_share_denied',
        subjectType: 'report',
        subjectId: share.reportId,
        message: `用户 ${actor.phone}（${actor.role}）尝试打开非本人报告卡片：${reason}`,
        severity: 'warning',
      },
    })
    await this.auditService.record({
      actor,
      action: 'report.share_denied',
      resourceType: 'report',
      resourceId: share.reportId,
      merchantId: share.merchantId,
      detail: { shareId: share.id, forwarderId: share.forwarderId, reason },
    })
  }

  private async isSubscriptionAvailable(): Promise<boolean> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: SUBSCRIPTION_CONFIG_KEY },
    })
    const value = config?.value
    return Boolean(
      value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>).enabled === true,
    )
  }
}
