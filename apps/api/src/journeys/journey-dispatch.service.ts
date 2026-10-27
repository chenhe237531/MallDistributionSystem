import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import { Role } from '@mall/shared'
import { NotificationsService } from '../notifications/notifications.service'
import { PrismaService } from '../prisma/prisma.service'
import { dateKey, dayOffsetOf, isQuietHours, wallClockMinutes } from './journey-date'
import { JourneysService } from './journeys.service'

const EXPIRE_MS = 2 * 60 * 60 * 1000

/**
 * 推送调度器（PRD §6.3）：
 * - 每 5 分钟投递到点任务到站内通知；
 * - 每 30 分钟检查清肠药就绪检查点（D-2 20:30 / D-1 12:00 / D-1 19:30 / D0 07:30）；
 * - 每日 01:00 推进旅程阶段并完成 D+35 后的旅程。
 */
@Injectable()
export class JourneyDispatchService {
  private readonly logger = new Logger(JourneyDispatchService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly journeysService: JourneysService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async dispatchCron() {
    await this.dispatchDue()
  }

  @Cron('*/30 * * * *')
  async bowelPrepCron() {
    await this.checkBowelPrep()
  }

  @Cron('0 1 * * *')
  async rolloverCron() {
    await this.rollover()
  }

  /** 支付后长期未排期：每 2 天晚场引导一次，最多 5 次（PRD 8.2） */
  @Cron('0 20 * * *')
  async scheduleReminderCron() {
    await this.remindPendingSchedules()
  }

  /**
   * 支付后长期未排期：pending_schedule 期间每 2 天晚场引导一次，最多 5 次（PRD 8.2）。
   * 提醒次数通过 dedupeKey 前缀 `sched_remind:{journeyId}:{n}` 计数，不落库新字段。
   */
  async remindPendingSchedules(now = new Date()) {
    const journeys = await this.prisma.transplantJourney.findMany({
      where: { status: 'pending_schedule' },
      select: { id: true, customerId: true, createdAt: true },
    })
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

    let reminded = 0
    for (const journey of journeys) {
      const prefix = `sched_remind:${journey.id}:`
      const where = { dedupeKey: { startsWith: prefix } }
      const [count, last] = await Promise.all([
        this.prisma.notification.count({ where }),
        this.prisma.notification.findFirst({ where, orderBy: { createdAt: 'desc' } }),
      ])
      if (count >= 5) {
        continue
      }
      // 开通当日不打扰（开通欢迎通知已含排期引导），此后每 2 天一次
      if (journey.createdAt >= startOfToday) {
        continue
      }
      if (last && now.getTime() - last.createdAt.getTime() < TWO_DAYS_MS) {
        continue
      }
      await this.notificationsService.emit({
        type: 'journey_schedule_reminder',
        recipientId: journey.customerId,
        recipientRole: Role.CUSTOMER,
        subjectType: 'TransplantJourney',
        subjectId: journey.id,
        title: '请设置移植日',
        body: '您的健康助手尚未设置移植日，设置后将按早、中、晚三时段推送个性化注意事项。建议将移植日设置为至少 8 天后，以保证完整准备期。',
        templateCode: 'journey_schedule_reminder',
        dedupeKey: `${prefix}${count}`,
        payload: { journeyId: journey.id, entry: `/pages/journey/index?id=${journey.id}` },
      })
      reminded += 1
    }
    return { scanned: journeys.length, reminded }
  }

  /** 投递到点任务；免打扰时段顺延合并，超过 2 小时未投递标记过期不补发 */
  async dispatchDue(now = new Date()) {
    const tasks = await this.prisma.journeyPushTask.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: now },
        journey: { status: 'active' },
      },
      include: { journey: { select: { id: true, customerId: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 300,
    })

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const task of tasks) {
      if (now.getTime() - task.scheduledAt.getTime() > EXPIRE_MS) {
        await this.prisma.journeyPushTask.update({
          where: { id: task.id },
          data: { status: 'skipped', skipReason: 'expired' },
        })
        skipped += 1
        continue
      }
      if (isQuietHours(now)) {
        await this.prisma.journeyPushTask.update({
          where: { id: task.id },
          data: { status: 'skipped', skipReason: 'merged_quiet_hours' },
        })
        skipped += 1
        continue
      }
      try {
        const notification = await this.notificationsService.emit({
          type: 'journey_push',
          recipientId: task.journey.customerId,
          recipientRole: Role.CUSTOMER,
          subjectType: 'TransplantJourney',
          subjectId: task.journey.id,
          title: task.title,
          body: task.body,
          templateCode: task.templateCode,
          templateVersion: task.templateVersion,
          dedupeKey: `jpt:${task.id}`,
          payload: {
            journeyId: task.journey.id,
            taskId: task.id,
            dayOffset: task.dayOffset,
            slot: task.slot,
          },
        })
        await this.prisma.journeyPushTask.update({
          where: { id: task.id },
          data: {
            status: 'sent',
            sentAt: now,
            notificationId: notification.id,
            skipReason: null,
          },
        })
        sent += 1
      } catch (cause) {
        // 并发重复投递命中 dedupeKey 唯一约束时视为已发送
        if (
          cause instanceof Prisma.PrismaClientKnownRequestError &&
          cause.code === 'P2002'
        ) {
          const existing = await this.prisma.notification.findUnique({
            where: { dedupeKey: `jpt:${task.id}` },
          })
          await this.prisma.journeyPushTask.update({
            where: { id: task.id },
            data: {
              status: 'sent',
              sentAt: now,
              notificationId: existing?.id,
            },
          })
          sent += 1
          continue
        }
        this.logger.warn(`推送任务 ${task.id} 投递失败：${String(cause)}`)
        await this.prisma.journeyPushTask.update({
          where: { id: task.id },
          data: { status: 'failed', skipReason: 'dispatch_failed' },
        })
        failed += 1
      }
    }

    await this.flushQuietDigest(now)
    return { scanned: tasks.length, sent, skipped, failed }
  }

  /** 免打扰时段跳过的任务合并为次日一条汇总通知（PRD §4.4） */
  private async flushQuietDigest(now: Date) {
    if (isQuietHours(now)) {
      return
    }
    const merged = await this.prisma.journeyPushTask.findMany({
      where: {
        status: 'skipped',
        skipReason: 'merged_quiet_hours',
        scheduledAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      },
      include: { journey: { select: { id: true, customerId: true } } },
      orderBy: { scheduledAt: 'asc' },
    })
    if (merged.length === 0) {
      return
    }
    const groups = new Map<string, { customerId: string; count: number; ids: string[] }>()
    for (const task of merged) {
      const group = groups.get(task.journey.id) ?? {
        customerId: task.journey.customerId,
        count: 0,
        ids: [],
      }
      group.count += 1
      group.ids.push(task.id)
      groups.set(task.journey.id, group)
    }
    for (const [journeyId, group] of groups) {
      const dedupeKey = `jpt_digest:${journeyId}:${dateKey(now)}`
      const existing = await this.prisma.notification.findUnique({ where: { dedupeKey } })
      if (!existing) {
        await this.notificationsService.emit({
          type: 'journey_digest',
          recipientId: group.customerId,
          recipientRole: Role.CUSTOMER,
          subjectType: 'TransplantJourney',
          subjectId: journeyId,
          title: '昨日提醒汇总',
          body: `您在免打扰时段有 ${group.count} 条健康提醒未推送，请打开健康助手查看今日安排。`,
          templateCode: 'journey_digest',
          dedupeKey,
          payload: { journeyId, entry: `/pages/journey/index?id=${journeyId}` },
        })
      }
      await this.prisma.journeyPushTask.updateMany({
        where: { id: { in: group.ids } },
        data: { skipReason: 'merged_digested' },
      })
    }
  }

  /** 清肠药就绪检查点：未就绪时催办用户并预警商家（PRD §5.4） */
  async checkBowelPrep(now = new Date()) {
    const minutes = wallClockMinutes(now)
    const isPrepNight = minutes >= 20 * 60 + 30 && minutes < 21 * 60
    const isNoon = minutes >= 12 * 60 && minutes < 12 * 60 + 30
    const isEvening = minutes >= 19 * 60 + 30 && minutes < 20 * 60
    const isMorning = minutes >= 7 * 60 + 30 && minutes < 8 * 60
    if (!isPrepNight && !isNoon && !isEvening && !isMorning) {
      return { checked: 0, notified: 0 }
    }

    const journeys = await this.prisma.transplantJourney.findMany({
      where: {
        status: 'active',
        bowelPrepStatus: { in: ['none', 'platform_ordered'] },
        transplantDate: { not: null },
      },
      include: { bowelPrep: true },
    })

    let notified = 0
    for (const journey of journeys) {
      const offset = dayOffsetOf(journey.transplantDate as Date, now)
      const context = await this.journeysService.journeyWithCustomer(journey.id)
      const customer = context?.customer ?? null
      const customerName = customer?.name ?? '客户'
      const phone = customer?.phone ?? ''
      const transplantDateLabel = dateKey(journey.transplantDate as Date)

      if (isPrepNight && offset === -2) {
        notified += await this.emitOnce({
          dedupeKey: `bp_check:${journey.id}`,
          recipientId: journey.customerId,
          title: '清肠药就绪检查',
          body: '移植前 1 天需口服聚乙二醇电解质散清肠。请提前备好 2 袋，可在此从平台购买，或自行购买后确认。',
          journeyId: journey.id,
        })
      }

      if (isNoon && offset === -1) {
        notified += await this.emitOnce({
          dedupeKey: `bp_escalate_noon:${journey.id}`,
          recipientId: journey.customerId,
          title: '清肠药尚未确认备好',
          body: '明早即开始移植，请立即确认清肠药已备好；未备好可从平台购买或自行购买后确认，避免影响移植。',
          journeyId: journey.id,
        })
        notified += await this.emitOnce({
          dedupeKey: `bp_alert_merchant:${journey.id}`,
          recipientId: journey.merchantId,
          recipientRole: Role.MERCHANT,
          title: '客户清肠药未就绪',
          body: `${customerName}${phone ? `（${phone}）` : ''} 的移植日为 ${transplantDateLabel}，清肠药尚未确认备好，请及时跟进。`,
          journeyId: journey.id,
        })
      }

      if (isEvening && offset === -1) {
        notified += await this.emitOnce({
          dedupeKey: `bp_escalate_evening:${journey.id}`,
          recipientId: journey.customerId,
          title: '今晚清肠，请确认药物',
          body: '今晚晚餐后需服用聚乙二醇电解质散。若尚未备好，请立即联系商家，避免影响明日移植。',
          journeyId: journey.id,
        })
      }

      if (isMorning && offset === 0) {
        notified += await this.emitOnce({
          dedupeKey: `bp_alert_final:${journey.id}`,
          recipientId: journey.merchantId,
          recipientRole: Role.MERCHANT,
          title: '今日移植·清肠药仍未就绪',
          body: `${customerName}${phone ? `（${phone}）` : ''} 今日移植，清肠药仍未确认备好，移植可能受影响，请立即联系。`,
          journeyId: journey.id,
        })
      }
    }
    return { checked: journeys.length, notified }
  }

  private async emitOnce(input: {
    dedupeKey: string
    recipientId: string
    recipientRole?: Role
    title: string
    body: string
    journeyId: string
  }): Promise<number> {
    const existing = await this.prisma.notification.findUnique({
      where: { dedupeKey: input.dedupeKey },
    })
    if (existing) {
      return 0
    }
    await this.notificationsService.emit({
      type: 'journey_bowel_prep_alert',
      recipientId: input.recipientId,
      recipientRole: input.recipientRole ?? Role.CUSTOMER,
      subjectType: 'TransplantJourney',
      subjectId: input.journeyId,
      title: input.title,
      body: input.body,
      templateCode: input.dedupeKey.split(':')[0],
      dedupeKey: input.dedupeKey,
      payload: { journeyId: input.journeyId, entry: `/pages/journey/index?id=${input.journeyId}` },
    })
    return 1
  }

  /** 每日 01:00：D+35 之后旅程转已完成 */
  async rollover(now = new Date()) {    const active = await this.prisma.transplantJourney.findMany({
      where: { status: 'active', transplantDate: { not: null } },
      select: { id: true, transplantDate: true },
    })
    let completed = 0
    for (const journey of active) {
      const offset = dayOffsetOf(journey.transplantDate as Date, now)
      if (offset > 35) {
        await this.prisma.transplantJourney.update({
          where: { id: journey.id },
          data: { status: 'completed', completedAt: now },
        })
        completed += 1
      }
    }
    return { scanned: active.length, completed }
  }
}
