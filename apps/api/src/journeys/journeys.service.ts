import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import {
  BOWEL_PREP_CATEGORY,
  Role,
  TRANSPLANT_SERVICE_CATEGORY,
  PUSH_SLOT_ORDER,
  dayOffsetLabel,
  journeyPhase,
} from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { PrismaService } from '../prisma/prisma.service'
import {
  CancelJourneyDto,
  PauseJourneyDto,
  QueryJourneysDto,
  ResumeJourneyDto,
  ScheduleJourneyDto,
  SelfConfirmBowelPrepDto,
} from './dto/journey.dto'
import {
  addDays,
  dateKey,
  dayOffsetOf,
  parseDateOnly,
  scheduledAtFor,
  startOfDay,
} from './journey-date'
import { buildJourneyPushTasks } from './journey-templates'
import type { AuthUser } from '../auth/auth-user.type'

const DEFAULT_SELF_DRUG = '聚乙二醇电解质散'

type JourneyRow = Prisma.TransplantJourneyGetPayload<{
  include: { bowelPrep: true }
}>

type TaskRow = Prisma.JourneyPushTaskGetPayload<Record<string, never>>

/**
 * 移植后健康助手：旅程开通、排期、推送计划重建、清肠药双路径与权限判定。
 * 业务规则见 doc/health-assistant-prd.html §3 / §5 / §7。
 */
@Injectable()
export class JourneysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  /* ============================================================
   * 开通与订单联动（FR-HA-01）
   * ============================================================ */

  /**
   * 支付成功后按移植服务商品行开通旅程，幂等。
   * 由 SalesOrdersService.registerPayment 在支付事务提交后调用。
   */
  async ensureForOrder(orderId: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    if (!order) {
      return []
    }
    const productIds = [...new Set(order.items.map((item) => item.productId))]
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, category: true },
    })
    const serviceItemIds = new Set(
      products
        .filter((product) => product.category === TRANSPLANT_SERVICE_CATEGORY)
        .map((product) => product.id),
    )
    const serviceItems = order.items.filter((item) => serviceItemIds.has(item.productId))

    const created: JourneyRow[] = []
    for (const item of serviceItems) {
      const existing = await this.prisma.transplantJourney.findUnique({
        where: { orderId_orderItemId: { orderId: order.id, orderItemId: item.id } },
        include: { bowelPrep: true },
      })
      if (existing) {
        created.push(existing)
        continue
      }
      const journey = await this.prisma.transplantJourney
        .create({
          data: {
            journeyNo: this.generateJourneyNo(),
            orderId: order.id,
            orderItemId: item.id,
            customerId: order.customerId,
            merchantId: order.merchantId,
          },
          include: { bowelPrep: true },
        })
        .catch(() => null)
      if (!journey) {
        // 并发重复开通：唯一约束兜底，回读既有旅程
        const fallback = await this.prisma.transplantJourney.findUnique({
          where: { orderId_orderItemId: { orderId: order.id, orderItemId: item.id } },
          include: { bowelPrep: true },
        })
        if (fallback) {
          created.push(fallback)
        }
        continue
      }
      created.push(journey)
      await this.notificationsService.emit({
        type: 'journey_opened',
        recipientId: order.customerId,
        recipientRole: Role.CUSTOMER,
        subjectType: 'TransplantJourney',
        subjectId: journey.id,
        title: '健康助手已开通',
        body: '您购买的移植服务已开通健康助手，设置移植日后将按早、中、晚三时段推送注意事项。',
        templateCode: 'journey_opened',
        dedupeKey: `journey_welcome:${journey.id}`,
        payload: { journeyId: journey.id, entry: `/pages/journey/index?id=${journey.id}` },
      })
    }
    return created
  }

  /** 支付成功：开通旅程 + 清肠药平台订单支付后进入「已下单待备好」 */
  async onOrderPaid(orderId: string) {
    const journeys = await this.ensureForOrder(orderId)
    const record = await this.prisma.bowelPrepRecord.findFirst({ where: { orderId } })
    if (record) {
      if (record.readyAt == null) {
        await this.prisma.transplantJourney.updateMany({
          where: { id: record.journeyId, bowelPrepStatus: 'none' },
          data: { bowelPrepStatus: 'platform_ordered' },
        })
      }
    }
    return journeys
  }

  /** 退款联动：服务订单全额退款取消旅程；清肠药订单全额退款回退就绪状态 */
  async onOrderRefund(orderId: string, fullyRefunded: boolean) {
    if (!fullyRefunded) {
      return
    }
    const journeys = await this.prisma.transplantJourney.findMany({
      where: { orderId, status: { in: ['pending_schedule', 'active', 'paused'] } },
    })
    for (const journey of journeys) {
      await this.prisma.$transaction(async (tx) => {
        await tx.transplantJourney.update({
          where: { id: journey.id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelReason: '移植服务订单已全额退款',
          },
        })
        await tx.journeyPushTask.updateMany({
          where: { journeyId: journey.id, status: 'pending' },
          data: { status: 'skipped', skipReason: 'cancelled' },
        })
      })
    }

    const record = await this.prisma.bowelPrepRecord.findFirst({ where: { orderId } })
    if (record) {
      await this.prisma.bowelPrepRecord.update({
        where: { id: record.id },
        data: {
          path: null,
          productId: null,
          orderId: null,
          readyAt: null,
          readyBy: null,
        },
      })
      await this.prisma.transplantJourney.update({
        where: { id: record.journeyId },
        data: { bowelPrepStatus: 'none' },
      })
    }
  }

  /* ============================================================
   * 查询与序列化
   * ============================================================ */

  async listMine(actor: AuthUser) {
    const journeys = await this.prisma.transplantJourney.findMany({
      where: { customerId: actor.sub },
      include: { bowelPrep: true },
      orderBy: { createdAt: 'desc' },
    })
    const now = new Date()
    const ids = journeys.map((journey) => journey.id)
    const offsets = new Map(
      journeys
        .filter((journey) => journey.transplantDate)
        .map((journey) => [journey.id, dayOffsetOf(journey.transplantDate as Date, now)]),
    )
    const tasks =
      ids.length === 0
        ? []
        : await this.prisma.journeyPushTask.findMany({
            where: {
              journeyId: { in: ids },
              dayOffset: {
                in: [...new Set([...offsets.values()].map((offset) => offset))],
              },
            },
            orderBy: [{ dayOffset: 'asc' }, { slot: 'asc' }],
          })
    return journeys.map((journey) =>
      this.serializeJourney(journey, {
        now,
        todayTasks: this.sortTasks(
          tasks.filter(
            (task) =>
              task.journeyId === journey.id && task.dayOffset === offsets.get(journey.id),
          ),
        ),
      }),
    )
  }

  async list(actor: AuthUser, query: QueryJourneysDto) {
    const where: Prisma.TransplantJourneyWhereInput = actor.roles.includes(Role.PLATFORM)
      ? {}
      : { merchantId: actor.sub }
    if (query.status) {
      where.status = query.status as Prisma.TransplantJourneyWhereInput['status']
    }
    if (query.bowelPrepStatus) {
      where.bowelPrepStatus =
        query.bowelPrepStatus as Prisma.TransplantJourneyWhereInput['bowelPrepStatus']
    }
    if (query.alert === '1') {
      where.status = 'active'
      where.bowelPrepStatus = { in: ['none', 'platform_ordered'] }
    }

    const journeys = await this.prisma.transplantJourney.findMany({
      where,
      include: { bowelPrep: true },
      orderBy: [{ transplantDate: 'asc' }, { createdAt: 'desc' }],
    })
    const now = new Date()
    const filtered =
      query.alert === '1'
        ? journeys.filter((journey) => {
            if (!journey.transplantDate) {
              return false
            }
            const offset = dayOffsetOf(journey.transplantDate, now)
            return offset >= -2 && offset <= 1
          })
        : journeys

    const customerIds = [...new Set(filtered.map((journey) => journey.customerId))]
    const customers = await this.prisma.user.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true },
    })
    const customerById = new Map(customers.map((customer) => [customer.id, customer]))
    return filtered.map((journey) => ({
      ...this.serializeJourney(journey, { now }),
      customer: customerById.get(journey.customerId) ?? null,
    }))
  }

  async getOne(id: string, actor: AuthUser) {
    const journey = await this.prisma.transplantJourney.findUnique({
      where: { id },
      include: { bowelPrep: true, pushTasks: { orderBy: [{ dayOffset: 'asc' }, { slot: 'asc' }] } },
    })
    if (!journey) {
      throw new NotFoundException('旅程不存在')
    }
    this.assertAccess(journey, actor)
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: journey.orderId },
      select: { id: true, orderNo: true, contactName: true, contactPhone: true, address: true },
    })
    const customer = await this.prisma.user.findUnique({
      where: { id: journey.customerId },
      select: { id: true, name: true, phone: true },
    })
    const now = new Date()
    const dayOffset = journey.transplantDate
      ? dayOffsetOf(journey.transplantDate, now)
      : null
    return {
      ...this.serializeJourney(journey, {
        now,
        todayTasks:
          dayOffset == null
            ? []
            : this.sortTasks(
                journey.pushTasks.filter((task) => task.dayOffset === dayOffset),
              ),
      }),
      order,
      customer,
      timeline: this.sortTasks(journey.pushTasks).map((task) => this.serializeTask(task)),
    }
  }

  async timeline(id: string, actor: AuthUser, from?: number, to?: number) {
    const journey = await this.requireJourney(id, actor)
    const tasks = await this.prisma.journeyPushTask.findMany({
      where: {
        journeyId: journey.id,
        ...(Number.isFinite(from) || Number.isFinite(to)
          ? {
              dayOffset: {
                ...(Number.isFinite(from) ? { gte: from } : {}),
                ...(Number.isFinite(to) ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ dayOffset: 'asc' }, { slot: 'asc' }],
    })
    return this.sortTasks(tasks).map((task) => this.serializeTask(task))
  }

  /* ============================================================
   * 排期 / 暂停 / 恢复 / 取消
   * ============================================================ */

  async schedule(id: string, dto: ScheduleJourneyDto, actor: AuthUser) {
    const journey = await this.requireJourney(id, actor)
    if (!actor.roles.includes(Role.PLATFORM) && !actor.roles.includes(Role.MERCHANT)) {
      if (!actor.roles.includes(Role.CUSTOMER)) {
        throw new ForbiddenException('无权设置移植日')
      }
    }
    if (journey.status === 'completed' || journey.status === 'cancelled') {
      throw new BadRequestException('该旅程已结束，不能修改移植日')
    }
    const transplantDate = this.parseTransplantDate(dto.transplantDate)
    const dosingScheme = dto.dosingScheme ?? journey.dosingScheme

    const conflict = await this.prisma.transplantJourney.findFirst({
      where: {
        customerId: journey.customerId,
        status: 'active',
        id: { not: journey.id },
      },
    })
    if (conflict) {
      throw new BadRequestException('当前已有进行中的旅程，请完成后再排期')
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.transplantJourney.update({
        where: { id: journey.id },
        data: {
          transplantDate,
          dosingScheme,
          status: 'active',
          pauseReason: null,
          templateVersion: { increment: 1 },
        },
        include: { bowelPrep: true },
      })
      await this.rebuildPushTasks(tx, result)
      return result
    })

    await this.auditService.record({
      actor,
      action: 'journey.schedule',
      resourceType: 'TransplantJourney',
      resourceId: journey.id,
      orderId: journey.orderId,
      customerId: journey.customerId,
      merchantId: journey.merchantId,
      detail: { transplantDate: dto.transplantDate, dosingScheme },
    })
    return this.serializeJourney(updated, { now: new Date() })
  }

  async pause(id: string, dto: PauseJourneyDto, actor: AuthUser) {
    const journey = await this.requireJourney(id, actor)
    if (journey.status !== 'active') {
      throw new BadRequestException('只有进行中的旅程可以暂停')
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.transplantJourney.update({
        where: { id: journey.id },
        data: { status: 'paused', pauseReason: dto.reason ?? null },
      })
      await tx.journeyPushTask.updateMany({
        where: { journeyId: journey.id, status: 'pending' },
        data: { status: 'skipped', skipReason: 'paused' },
      })
    })
    await this.auditService.record({
      actor,
      action: 'journey.pause',
      resourceType: 'TransplantJourney',
      resourceId: journey.id,
      customerId: journey.customerId,
      merchantId: journey.merchantId,
      detail: { reason: dto.reason ?? null },
    })
    return this.getOne(journey.id, actor)
  }

  async resume(id: string, dto: ResumeJourneyDto, actor: AuthUser) {
    const journey = await this.requireJourney(id, actor)
    if (journey.status !== 'paused') {
      throw new BadRequestException('只有已暂停的旅程可以恢复')
    }
    const transplantDate = this.parseTransplantDate(dto.transplantDate)
    const dosingScheme = dto.dosingScheme ?? journey.dosingScheme
    const conflict = await this.prisma.transplantJourney.findFirst({
      where: { customerId: journey.customerId, status: 'active', id: { not: journey.id } },
    })
    if (conflict) {
      throw new BadRequestException('当前已有进行中的旅程，请完成后再恢复')
    }
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.transplantJourney.update({
        where: { id: journey.id },
        data: {
          transplantDate,
          dosingScheme,
          status: 'active',
          pauseReason: null,
          templateVersion: { increment: 1 },
        },
      })
      await this.rebuildPushTasks(tx, result)
    })
    await this.auditService.record({
      actor,
      action: 'journey.resume',
      resourceType: 'TransplantJourney',
      resourceId: journey.id,
      customerId: journey.customerId,
      merchantId: journey.merchantId,
      detail: { transplantDate: dto.transplantDate },
    })
    return this.getOne(journey.id, actor)
  }

  async cancel(id: string, dto: CancelJourneyDto, actor: AuthUser) {
    const journey = await this.requireJourney(id, actor)
    if (journey.status === 'cancelled' || journey.status === 'completed') {
      return journey
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.transplantJourney.update({
        where: { id: journey.id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: dto.reason ?? '平台取消',
        },
      })
      await tx.journeyPushTask.updateMany({
        where: { journeyId: journey.id, status: 'pending' },
        data: { status: 'skipped', skipReason: 'cancelled' },
      })
    })
    await this.auditService.record({
      actor,
      action: 'journey.cancel',
      resourceType: 'TransplantJourney',
      resourceId: journey.id,
      customerId: journey.customerId,
      merchantId: journey.merchantId,
      detail: { reason: dto.reason ?? null },
    })
    return this.getOne(journey.id, actor)
  }

  /* ============================================================
   * 清肠药双路径（FR-HA-06 / 07 / 08）
   * ============================================================ */

  async placeBowelPrepOrder(id: string, actor: AuthUser) {
    const journey = await this.requireJourney(id, actor)
    if (journey.customerId !== actor.sub) {
      throw new ForbiddenException('只有客户本人可以下单清肠药')
    }
    if (journey.bowelPrepStatus === 'ready' || journey.bowelPrepStatus === 'self_confirmed') {
      throw new BadRequestException('清肠药已备好，无需重复购买')
    }

    const existing = await this.prisma.bowelPrepRecord.findUnique({
      where: { journeyId: journey.id },
    })
    if (existing?.orderId) {
      const order = await this.prisma.salesOrder.findUnique({ where: { id: existing.orderId } })
      if (order && !['cancelled', 'refunded'].includes(order.status)) {
        return { order, reused: true }
      }
    }

    const listing = await this.findBowelPrepListing(journey.merchantId)
    if (!listing) {
      throw new BadRequestException('清肠药暂不可购买，请选择自行购买')
    }
    const serviceOrder = await this.prisma.salesOrder.findUnique({
      where: { id: journey.orderId },
      select: {
        contactName: true,
        contactPhone: true,
        address: true,
        preAttributionChannelId: true,
        preAttributionChannelType: true,
      },
    })

    const order = await this.prisma.salesOrder.create({
      data: {
        orderNo: this.generateOrderNo(),
        merchantId: listing.merchantId,
        customerId: journey.customerId,
        totalAmountCents: listing.retailPriceCents,
        contactName: serviceOrder?.contactName,
        contactPhone: serviceOrder?.contactPhone,
        address: serviceOrder?.address,
        preAttributionChannelId: serviceOrder?.preAttributionChannelId,
        preAttributionChannelType: serviceOrder?.preAttributionChannelType,
        commissionRuleVersion: 'v1',
        items: {
          create: {
            productId: listing.productId,
            productName: listing.product.name,
            skuCode: listing.product.skuCode,
            unitPriceCents: listing.retailPriceCents,
            quantity: 1,
            amountCents: listing.retailPriceCents,
            supplyPriceCents: listing.product.supplyPriceCents,
            platformServiceRateBps: listing.product.platformServiceRateBps,
            commissionRateCapBps: listing.product.commissionRateCapBps,
          },
        },
      },
      include: { items: true },
    })

    await this.prisma.bowelPrepRecord.upsert({
      where: { journeyId: journey.id },
      create: {
        journeyId: journey.id,
        path: 'platform',
        productId: listing.productId,
        orderId: order.id,
      },
      update: {
        path: 'platform',
        productId: listing.productId,
        orderId: order.id,
        selfDrugName: null,
        selfNote: null,
        selfPhotoUrl: null,
      },
    })
    await this.auditService.record({
      actor,
      action: 'journey.bowel_prep.order',
      resourceType: 'TransplantJourney',
      resourceId: journey.id,
      orderId: order.id,
      orderNo: order.orderNo,
      customerId: journey.customerId,
      merchantId: journey.merchantId,
      detail: { productId: listing.productId, amountCents: order.totalAmountCents },
    })
    return { order, reused: false }
  }

  async confirmSelfPurchase(id: string, dto: SelfConfirmBowelPrepDto, actor: AuthUser) {
    const journey = await this.requireJourney(id, actor)
    if (journey.customerId !== actor.sub) {
      throw new ForbiddenException('只有客户本人可以确认自购')
    }
    if (journey.bowelPrepStatus === 'ready') {
      throw new BadRequestException('清肠药已确认备好，如需修改请先撤销')
    }
    const now = new Date()
    await this.prisma.$transaction(async (tx) => {
      await tx.bowelPrepRecord.upsert({
        where: { journeyId: journey.id },
        create: {
          journeyId: journey.id,
          path: 'self',
          selfDrugName: dto.drugName?.trim() || DEFAULT_SELF_DRUG,
          selfNote: dto.note?.trim() || null,
          selfPhotoUrl: dto.photoUrl?.trim() || null,
          readyAt: now,
          readyBy: 'customer',
        },
        update: {
          path: 'self',
          selfDrugName: dto.drugName?.trim() || DEFAULT_SELF_DRUG,
          selfNote: dto.note?.trim() || null,
          selfPhotoUrl: dto.photoUrl?.trim() || null,
          readyAt: now,
          readyBy: 'customer',
        },
      })
      await tx.transplantJourney.update({
        where: { id: journey.id },
        data: { bowelPrepStatus: 'self_confirmed' },
      })
    })
    await this.auditService.record({
      actor,
      action: 'journey.bowel_prep.self_confirmed',
      resourceType: 'TransplantJourney',
      resourceId: journey.id,
      customerId: journey.customerId,
      merchantId: journey.merchantId,
      detail: {
        drugName: dto.drugName?.trim() || DEFAULT_SELF_DRUG,
        note: dto.note ?? null,
      },
    })
    return this.getOne(journey.id, actor)
  }

  async markBowelPrepReady(id: string, actor: AuthUser) {
    const journey = await this.requireJourney(id, actor)
    if (journey.bowelPrepStatus === 'ready' || journey.bowelPrepStatus === 'self_confirmed') {
      return this.getOne(journey.id, actor)
    }
    const record = await this.prisma.bowelPrepRecord.findUnique({
      where: { journeyId: journey.id },
    })
    if (!record || record.path !== 'platform' || !record.orderId) {
      throw new BadRequestException('请先选择平台购买或自购确认')
    }
    const order = await this.prisma.salesOrder.findUnique({ where: { id: record.orderId } })
    if (!order || order.status === 'pending_payment') {
      throw new BadRequestException('清肠药订单尚未支付，暂不能确认备好')
    }
    if (order.status === 'cancelled' || order.status === 'refunded') {
      throw new BadRequestException('清肠药订单已关闭，请重新购买或选择自行购买')
    }
    const readyBy = actor.roles.includes(Role.MERCHANT) ? 'merchant' : 'customer'
    const now = new Date()
    await this.prisma.$transaction(async (tx) => {
      await tx.bowelPrepRecord.update({
        where: { id: record.id },
        data: { readyAt: now, readyBy },
      })
      await tx.transplantJourney.update({
        where: { id: journey.id },
        data: { bowelPrepStatus: 'ready' },
      })
    })
    await this.auditService.record({
      actor,
      action: 'journey.bowel_prep.ready',
      resourceType: 'TransplantJourney',
      resourceId: journey.id,
      orderId: order.id,
      orderNo: order.orderNo,
      customerId: journey.customerId,
      merchantId: journey.merchantId,
      detail: { readyBy },
    })
    return this.getOne(journey.id, actor)
  }

  /** 撤销就绪（PRD 8.10）：回到未准备，重新纳入 D-2/D-1 提醒 */
  async resetBowelPrep(id: string, actor: AuthUser) {
    const journey = await this.requireJourney(id, actor)
    const record = await this.prisma.bowelPrepRecord.findUnique({
      where: { journeyId: journey.id },
    })
    if (!record) {
      return this.getOne(journey.id, actor)
    }
    let nextStatus: 'none' | 'platform_ordered' = 'none'
    let path = record.path
    if (record.orderId) {
      const order = await this.prisma.salesOrder.findUnique({ where: { id: record.orderId } })
      if (order && !['pending_payment', 'cancelled', 'refunded'].includes(order.status)) {
        nextStatus = 'platform_ordered'
      } else {
        path = null
      }
    } else {
      path = null
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.bowelPrepRecord.update({
        where: { id: record.id },
        data: {
          path,
          readyAt: null,
          readyBy: null,
          selfDrugName: path === 'self' ? record.selfDrugName : null,
        },
      })
      await tx.transplantJourney.update({
        where: { id: journey.id },
        data: { bowelPrepStatus: nextStatus },
      })
    })
    await this.auditService.record({
      actor,
      action: 'journey.bowel_prep.reset',
      resourceType: 'TransplantJourney',
      resourceId: journey.id,
      customerId: journey.customerId,
      merchantId: journey.merchantId,
      detail: { nextStatus },
    })
    return this.getOne(journey.id, actor)
  }

  /* ============================================================
   * 平台运维
   * ============================================================ */

  async resendTask(journeyId: string, taskId: string, actor: AuthUser) {
    const task = await this.prisma.journeyPushTask.findUnique({ where: { id: taskId } })
    if (!task || task.journeyId !== journeyId) {
      throw new NotFoundException('推送任务不存在')
    }
    if (task.status === 'sent') {
      throw new BadRequestException('该任务已发送，无需补发')
    }
    const updated = await this.prisma.journeyPushTask.update({
      where: { id: task.id },
      data: { status: 'pending', scheduledAt: new Date(), sentAt: null, skipReason: null },
    })
    await this.auditService.record({
      actor,
      action: 'journey.push.resend',
      resourceType: 'TransplantJourney',
      resourceId: journeyId,
      detail: { taskId, templateCode: task.templateCode },
    })
    return updated
  }

  async overview(actor: AuthUser) {
    const where: Prisma.TransplantJourneyWhereInput = actor.roles.includes(Role.PLATFORM)
      ? {}
      : { merchantId: actor.sub }
    const [total, active, pendingSchedule, prepAlerts] = await Promise.all([
      this.prisma.transplantJourney.count({ where }),
      this.prisma.transplantJourney.count({ where: { ...where, status: 'active' } }),
      this.prisma.transplantJourney.count({ where: { ...where, status: 'pending_schedule' } }),
      this.prisma.transplantJourney.count({
        where: {
          ...where,
          status: 'active',
          bowelPrepStatus: { in: ['none', 'platform_ordered'] },
        },
      }),
    ])
    return { total, active, pendingSchedule, prepAlerts }
  }

  /* ============================================================
   * 内部工具
   * ============================================================ */

  private async requireJourney(id: string, actor: AuthUser) {
    const journey = await this.prisma.transplantJourney.findUnique({
      where: { id },
      include: { bowelPrep: true },
    })
    if (!journey) {
      throw new NotFoundException('旅程不存在')
    }
    this.assertAccess(journey, actor)
    return journey
  }

  private assertAccess(
    journey: { customerId: string; merchantId: string },
    actor: AuthUser,
  ) {
    if (actor.roles.includes(Role.PLATFORM)) {
      return
    }
    if (actor.roles.includes(Role.CUSTOMER) && journey.customerId === actor.sub) {
      return
    }
    if (actor.roles.includes(Role.MERCHANT) && journey.merchantId === actor.sub) {
      return
    }
    throw new ForbiddenException('无权访问该旅程')
  }

  private parseTransplantDate(value: string): Date {
    const date = parseDateOnly(value)
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('移植日格式为 yyyy-MM-dd')
    }
    const tomorrow = addDays(startOfDay(new Date()), 1)
    if (date < tomorrow) {
      throw new BadRequestException('移植日需不早于明天')
    }
    return date
  }

  private async rebuildPushTasks(
    tx: Prisma.TransactionClient,
    journey: {
      id: string
      transplantDate: Date | null
      dosingScheme: 'morning_once' | 'twice_daily'
    },
  ) {
    if (!journey.transplantDate) {
      return
    }
    await tx.journeyPushTask.deleteMany({
      where: {
        journeyId: journey.id,
        status: { in: ['pending', 'skipped', 'failed'] },
      },
    })
    const sent = await tx.journeyPushTask.findMany({
      where: { journeyId: journey.id, status: 'sent' },
      select: { dayOffset: true, slot: true },
    })
    const sentKeys = new Set(sent.map((task) => `${task.dayOffset}:${task.slot}`))
    const seeds = buildJourneyPushTasks({
      transplantDate: journey.transplantDate,
      dosingScheme: journey.dosingScheme,
    })
    for (const seed of seeds) {
      if (sentKeys.has(`${seed.dayOffset}:${seed.slot}`)) {
        continue
      }
      await tx.journeyPushTask.create({
        data: {
          journeyId: journey.id,
          dayOffset: seed.dayOffset,
          slot: seed.slot,
          scheduledAt: seed.scheduledAt,
          templateCode: seed.templateCode,
          templateVersion: seed.templateVersion,
          title: seed.title,
          body: seed.body,
        },
      })
    }
  }

  private async findBowelPrepListing(merchantId: string) {
    const baseWhere: Prisma.MerchantProductWhereInput = {
      status: 'active',
      product: { status: 'active', category: BOWEL_PREP_CATEGORY },
    }
    const preferred = await this.prisma.merchantProduct.findFirst({
      where: { ...baseWhere, merchantId },
      include: { product: true },
      orderBy: { retailPriceCents: 'asc' },
    })
    if (preferred) {
      return preferred
    }
    return this.prisma.merchantProduct.findFirst({
      where: baseWhere,
      include: { product: true },
      orderBy: { retailPriceCents: 'asc' },
    })
  }

  private serializeJourney(
    journey: JourneyRow,
    options: { now: Date; todayTasks?: TaskRow[] },
  ) {
    const dayOffset = journey.transplantDate
      ? dayOffsetOf(journey.transplantDate, options.now)
      : null
    const bowelPrep = journey.bowelPrep
      ? {
          path: journey.bowelPrep.path,
          orderId: journey.bowelPrep.orderId,
          productId: journey.bowelPrep.productId,
          selfDrugName: journey.bowelPrep.selfDrugName,
          selfNote: journey.bowelPrep.selfNote,
          selfPhotoUrl: journey.bowelPrep.selfPhotoUrl,
          readyAt: journey.bowelPrep.readyAt,
          readyBy: journey.bowelPrep.readyBy,
        }
      : null
    return {
      id: journey.id,
      journeyNo: journey.journeyNo,
      orderId: journey.orderId,
      orderItemId: journey.orderItemId,
      customerId: journey.customerId,
      merchantId: journey.merchantId,
      transplantDate: journey.transplantDate,
      dosingScheme: journey.dosingScheme,
      status: journey.status,
      bowelPrepStatus: journey.bowelPrepStatus,
      pauseReason: journey.pauseReason,
      dayOffset,
      dayOffsetLabel: dayOffset == null ? null : dayOffsetLabel(dayOffset),
      phase: journeyPhase(dayOffset),
      bowelPrep,
      todayTasks: (options.todayTasks ?? []).map((task) => this.serializeTask(task)),
      completedAt: journey.completedAt,
      cancelledAt: journey.cancelledAt,
      cancelReason: journey.cancelReason,
      createdAt: journey.createdAt,
    }
  }

  /** 数据库枚举按字母序排序，展示层统一重排为早 → 中 → 晚 */
  private sortTasks<T extends { dayOffset: number; slot: string }>(tasks: T[]): T[] {
    const slotOrder: Record<string, number> = Object.fromEntries(
      PUSH_SLOT_ORDER.map((slot, index) => [slot, index]),
    )
    return [...tasks].sort(
      (a, b) => a.dayOffset - b.dayOffset || (slotOrder[a.slot] ?? 9) - (slotOrder[b.slot] ?? 9),
    )
  }

  private serializeTask(task: TaskRow) {
    return {
      id: task.id,
      dayOffset: task.dayOffset,
      dayOffsetLabel: dayOffsetLabel(task.dayOffset),
      slot: task.slot,
      scheduledAt: task.scheduledAt,
      templateCode: task.templateCode,
      title: task.title,
      body: task.body,
      status: task.status,
      skipReason: task.skipReason,
      sentAt: task.sentAt,
      notificationId: task.notificationId,
    }
  }

  private generateJourneyNo(): string {
    return `J${dateKey(new Date()).replace(/-/g, '')}${randomBytes(2).toString('hex').toUpperCase()}`
  }

  private generateOrderNo(): string {
    return `SO${dateKey(new Date()).replace(/-/g, '')}${randomBytes(3).toString('hex').toUpperCase()}`
  }

  /** 清肠检查点所需的客户信息（供调度器与商家预警复用） */
  async journeyWithCustomer(journeyId: string) {
    const journey = await this.prisma.transplantJourney.findUnique({
      where: { id: journeyId },
      include: { bowelPrep: true },
    })
    if (!journey) {
      return null
    }
    const customer = await this.prisma.user.findUnique({
      where: { id: journey.customerId },
      select: { id: true, name: true, phone: true },
    })
    return { journey, customer }
  }

  /** 供调度器生成 D-2 / D-1 检查点绝对时刻 */
  scheduledAt(transplantDate: Date, dayOffset: number, slot: 'morning' | 'noon' | 'evening') {
    return scheduledAtFor(transplantDate, dayOffset, slot)
  }
}
