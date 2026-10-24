import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  Prisma,
  SalesOrderStatus as PrismaSalesOrderStatus,
} from '@prisma/client'
import { Cron, CronExpression } from '@nestjs/schedule'
import { randomBytes } from 'node:crypto'
import { Role } from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { ChannelsService } from '../channels/channels.service'
import { CommissionsService } from '../commissions/commissions.service'
import { NotificationsService } from '../notifications/notifications.service'
import { PrismaService } from '../prisma/prisma.service'
import { ProductsService } from '../products/products.service'
import { StatementsService } from '../statements/statements.service'
import { CreateSalesOrderDto, RefundSalesOrderDto } from './dto/sales-order.dto'
import type { AuthUser } from '../auth/auth-user.type'

@Injectable()
export class SalesOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly commissionsService: CommissionsService,
    private readonly statementsService: StatementsService,
    private readonly auditService: AuditService,
    private readonly channelsService: ChannelsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async storefront(channelCode?: string) {
    let merchantId: string | undefined
    if (channelCode) {
      const channel = await this.prisma.channelIdentity.findUnique({ where: { code: channelCode } })
      if (!channel || channel.status !== 'active') {
        throw new BadRequestException('渠道码无效或已停用')
      }
      if (channel.type === 'merchant') {
        merchantId = channel.userId
      }
    }

    const now = new Date()
    const listings = await this.prisma.merchantProduct.findMany({
      where: {
        status: 'active',
        ...(merchantId ? { merchantId } : {}),
        product: { status: 'active' },
      },
      include: {
        merchant: { select: { id: true, name: true, organization: true } },
        product: {
          include: {
            batches: {
              where: { remaining: { gt: 0 }, expiresAt: { gt: now } },
            },
            relatedLinks: {
              orderBy: { sort: 'asc' },
              select: { related: { select: { id: true, name: true, skuCode: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 搭配推荐：解析关联商品在各商家 active 上架中的最低价（优先当前渠道商家）
    const relatedIds = [
      ...new Set(
        listings.flatMap((listing) => listing.product.relatedLinks.map((link) => link.related.id)),
      ),
    ]
    const relatedListings =
      relatedIds.length > 0
        ? await this.prisma.merchantProduct.findMany({
            where: {
              status: 'active',
              productId: { in: relatedIds },
              product: { status: 'active' },
            },
            select: {
              id: true,
              merchantId: true,
              productId: true,
              retailPriceCents: true,
            },
          })
        : []
    const bestRelatedListing = new Map<string, (typeof relatedListings)[number]>()
    for (const related of relatedListings) {
      const current = bestRelatedListing.get(related.productId)
      if (!current) {
        bestRelatedListing.set(related.productId, related)
        continue
      }
      // 渠道商家自己的上架优先；同级再比价格
      const currentPreferred = merchantId ? current.merchantId === merchantId : false
      const relatedPreferred = merchantId ? related.merchantId === merchantId : false
      if (
        (relatedPreferred && !currentPreferred) ||
        (relatedPreferred === currentPreferred &&
          related.retailPriceCents < current.retailPriceCents)
      ) {
        bestRelatedListing.set(related.productId, related)
      }
    }
    const relatedPriceById = new Map(
      relatedIds.map((productId) => {
        const listing = bestRelatedListing.get(productId)
        return [
          productId,
          listing
            ? { listingId: listing.id, retailPriceCents: listing.retailPriceCents }
            : { listingId: null, retailPriceCents: null },
        ]
      }),
    )

    return listings.map((listing) => ({
      listingId: listing.id,
      merchantId: listing.merchantId,
      merchantName: listing.merchant.organization?.name ?? listing.merchant.name,
      productId: listing.productId,
      productName: listing.product.name,
      skuCode: listing.product.skuCode,
      retailPriceCents: listing.retailPriceCents,
      available: listing.product.batches.reduce((sum, batch) => sum + batch.remaining, 0),
      guideVideoUrl: listing.product.guideVideoUrl,
      intro: listing.product.intro,
      related: listing.product.relatedLinks.map((link) => {
        const price = relatedPriceById.get(link.related.id)
        return {
          productId: link.related.id,
          name: link.related.name,
          skuCode: link.related.skuCode,
          listingId: price?.listingId ?? null,
          retailPriceCents: price?.retailPriceCents ?? null,
        }
      }),
    }))
  }

  async create(actor: AuthUser, dto: CreateSalesOrderDto) {
    if (!actor.roles.includes(Role.CUSTOMER)) {
      throw new ForbiddenException('只有 C 端用户可以下单')
    }
    const listingIds = [...new Set(dto.items.map((item) => item.listingId))]
    const listings = await this.prisma.merchantProduct.findMany({
      where: { id: { in: listingIds } },
      include: { product: true, merchant: { select: { id: true, name: true } } },
    })
    if (listings.length !== listingIds.length) {
      throw new BadRequestException('商品不存在或已下架')
    }

    const merchantIds = new Set(listings.map((listing) => listing.merchantId))
    if (merchantIds.size > 1) {
      throw new BadRequestException('一张订单只能购买同一商家的商品')
    }

    let preAttributionChannelId: string | null = null
    let preAttributionChannelType: string | null = null
    if (dto.channelCode) {
      const channel = await this.prisma.channelIdentity.findUnique({
        where: { code: dto.channelCode },
      })
      if (!channel || channel.status !== 'active') {
        throw new BadRequestException('渠道码无效或已停用')
      }
      preAttributionChannelId = channel.id
      preAttributionChannelType = channel.type
    }

    const items = dto.items.map((input) => {
      const listing = listings.find((item) => item.id === input.listingId)
      if (!listing || listing.status !== 'active' || listing.product.status !== 'active') {
        throw new BadRequestException('商品不存在或已下架')
      }
      return {
        productId: listing.productId,
        productName: listing.product.name,
        skuCode: listing.product.skuCode,
        unitPriceCents: listing.retailPriceCents,
        quantity: input.quantity,
        amountCents: listing.retailPriceCents * input.quantity,
        supplyPriceCents: listing.product.supplyPriceCents,
        platformServiceRateBps: listing.product.platformServiceRateBps,
        commissionRateCapBps: listing.product.commissionRateCapBps,
      }
    })
    const totalAmountCents = items.reduce((sum, item) => sum + item.amountCents, 0)

    const order = await this.prisma.salesOrder.create({
      data: {
        orderNo: this.generateOrderNo(),
        merchantId: [...merchantIds][0],
        customerId: actor.sub,
        totalAmountCents,
        preAttributionChannelId,
        preAttributionChannelType,
        commissionRuleVersion: 'v1',
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        address: dto.address,
        items: { create: items },
      },
      include: { items: true, merchant: { select: { id: true, name: true } } },
    })
    await this.auditService.record({
      actor,
      action: 'order.create',
      resourceType: 'order',
      resourceId: order.id,
      orderId: order.id,
      orderNo: order.orderNo,
      customerId: order.customerId,
      channelId: preAttributionChannelId,
      merchantId: order.merchantId,
      detail: { totalAmountCents, items: items.map((item) => ({ skuCode: item.skuCode, quantity: item.quantity })) },
    })
    return order
  }

  async list(actor: AuthUser) {
    const where: Prisma.SalesOrderWhereInput = actor.roles.includes(Role.PLATFORM)
      ? {}
      : actor.roles.includes(Role.MERCHANT)
        ? { merchantId: actor.sub }
        : actor.roles.includes(Role.CUSTOMER)
          ? { customerId: actor.sub }
          : { id: '__none__' }

    return this.prisma.salesOrder.findMany({
      where,
      include: {
        items: true,
        merchant: { select: { id: true, name: true, organization: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getOne(id: string, actor: AuthUser) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        items: { include: { allocations: true } },
        refunds: true,
        merchant: { select: { id: true, name: true, organization: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
    })
    if (!order) {
      throw new NotFoundException('销售单不存在')
    }
    this.assertAccess(order, actor)
    return order
  }

  async registerPayment(id: string, paidAmountCents: number | undefined, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (!actor.roles.includes(Role.PLATFORM) && order.merchantId !== actor.sub) {
      throw new ForbiddenException('只有商家或平台可以登记支付状态')
    }
    if (order.paidAt) {
      return order
    }
    if (order.status !== PrismaSalesOrderStatus.pending_payment) {
      throw new BadRequestException('当前状态不能登记支付')
    }
    if (
      paidAmountCents !== undefined &&
      paidAmountCents !== order.totalAmountCents
    ) {
      throw new BadRequestException('登记支付金额必须等于订单应付金额')
    }

    const paid = await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const allocations = await this.productsService.allocateStockInTransaction(
          tx,
          item.productId,
          item.quantity,
        )
        for (const allocation of allocations) {
          await tx.salesStockAllocation.create({
            data: {
              orderItemId: item.id,
              orderId: order.id,
              batchId: allocation.batchId,
              batchNo: allocation.batchNo,
              quantity: allocation.quantity,
            },
          })
        }
      }
      const updated = await tx.salesOrder.update({
        where: { id },
        data: {
          status: PrismaSalesOrderStatus.paid,
          paidAt: new Date(),
          paidAmountCents: paidAmountCents ?? order.totalAmountCents,
        },
        include: { items: { include: { allocations: true } } },
      })
      await this.commissionsService.generateForOrderInTransaction(tx, order.id)
      return updated
    })
    await this.auditService.record({
      actor,
      action: 'order.pay',
      resourceType: 'order',
      resourceId: order.id,
      orderId: order.id,
      orderNo: order.orderNo,
      customerId: order.customerId,
      channelId: order.attributedChannelId ?? order.preAttributionChannelId,
      merchantId: order.merchantId,
      detail: { paidAmountCents: paid.paidAmountCents, status: paid.status },
    })
    await this.notificationsService.emit({
      type: 'order_paid',
      recipientId: order.customerId,
      recipientRole: Role.CUSTOMER,
      subjectType: 'order',
      subjectId: order.id,
      title: '支付成功',
      body: `订单 ${order.orderNo} 已支付成功，检测盒出库后可扫码激活。`,
      templateCode: 'order_paid',
      dedupeKey: `order_paid:${order.id}`,
      payload: { orderId: order.id, orderNo: order.orderNo },
    })
    await this.notificationsService.emit({
      type: 'order_paid',
      recipientId: order.merchantId,
      recipientRole: Role.MERCHANT,
      subjectType: 'order',
      subjectId: order.id,
      title: '新订单已支付',
      body: `订单 ${order.orderNo} 已完成支付，请及时发货。`,
      templateCode: 'order_paid',
      dedupeKey: `order_paid_merchant:${order.id}`,
      payload: { orderId: order.id, orderNo: order.orderNo },
    })
    const commissions = await this.prisma.commission.findMany({
      where: { orderId: order.id },
    })
    for (const commission of commissions) {
      await this.auditService.record({
        actor,
        action: 'commission.generate',
        resourceType: 'commission',
        resourceId: commission.id,
        orderId: order.id,
        orderNo: order.orderNo,
        customerId: order.customerId,
        channelId: order.attributedChannelId ?? order.preAttributionChannelId,
        merchantId: order.merchantId,
        detail: {
          commissionNo: commission.commissionNo,
          level: commission.level,
          beneficiaryId: commission.beneficiaryId,
          amountCents: commission.amountCents,
          ruleVersion: commission.ruleVersion,
        },
      })
    }
    return paid
  }

  async ship(id: string, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (!actor.roles.includes(Role.PLATFORM) && order.merchantId !== actor.sub) {
      throw new ForbiddenException('只有商家或平台可以发货')
    }
    if (
      order.status !== PrismaSalesOrderStatus.paid &&
      order.status !== PrismaSalesOrderStatus.pending_shipment
    ) {
      throw new BadRequestException('当前状态不能发货')
    }
    const shipped = await this.prisma.salesOrder.update({
      where: { id },
      data: { status: PrismaSalesOrderStatus.shipped, shippedAt: new Date() },
    })
    await this.notificationsService.emit({
      type: 'order_shipped',
      recipientId: order.customerId,
      recipientRole: Role.CUSTOMER,
      subjectType: 'order',
      subjectId: order.id,
      title: '订单已发货',
      body: `订单 ${order.orderNo} 已发货，收到检测盒后请扫码激活。`,
      templateCode: 'order_shipped',
      dedupeKey: `order_shipped:${order.id}`,
      payload: { orderId: order.id, orderNo: order.orderNo },
    })
    return shipped
  }

  async deliver(id: string, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (!actor.roles.includes(Role.PLATFORM) && order.merchantId !== actor.sub) {
      throw new ForbiddenException('只有商家或平台可以确认送达')
    }
    if (order.status !== PrismaSalesOrderStatus.shipped) {
      throw new BadRequestException('当前状态不能确认送达')
    }
    return this.prisma.salesOrder.update({
      where: { id },
      data: { status: PrismaSalesOrderStatus.pending_sampling },
    })
  }

  async markTesting(id: string, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (
      order.status !== PrismaSalesOrderStatus.pending_sampling &&
      order.status !== PrismaSalesOrderStatus.shipped
    ) {
      throw new BadRequestException('当前状态不能进入检测')
    }
    return this.prisma.salesOrder.update({
      where: { id },
      data: { status: PrismaSalesOrderStatus.testing },
    })
  }

  async markReportReady(id: string, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (order.status !== PrismaSalesOrderStatus.testing) {
      throw new BadRequestException('当前状态不能标记报告已出')
    }
    return this.prisma.salesOrder.update({
      where: { id },
      data: { status: PrismaSalesOrderStatus.report_ready },
    })
  }

  async complete(id: string, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (order.status !== PrismaSalesOrderStatus.report_ready) {
      throw new BadRequestException('当前状态不能完成')
    }
    return this.prisma.salesOrder.update({
      where: { id },
      data: { status: PrismaSalesOrderStatus.completed, completedAt: new Date() },
    })
  }

  async cancel(id: string, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (actor.roles.includes(Role.CUSTOMER) && order.customerId !== actor.sub) {
      throw new ForbiddenException('无权取消该订单')
    }
    if (!actor.roles.includes(Role.PLATFORM) && !actor.roles.includes(Role.MERCHANT) && !actor.roles.includes(Role.CUSTOMER)) {
      throw new ForbiddenException('无权取消该订单')
    }
    if (order.status !== PrismaSalesOrderStatus.pending_payment) {
      throw new BadRequestException('已支付订单请走退款流程')
    }
    return this.prisma.salesOrder.update({
      where: { id },
      data: { status: PrismaSalesOrderStatus.cancelled },
    })
  }

  async refund(id: string, dto: RefundSalesOrderDto, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (!actor.roles.includes(Role.PLATFORM) && order.merchantId !== actor.sub) {
      throw new ForbiddenException('只有商家或平台可以退款')
    }
    if (
      order.status === PrismaSalesOrderStatus.pending_payment ||
      order.status === PrismaSalesOrderStatus.cancelled ||
      order.status === PrismaSalesOrderStatus.refunded
    ) {
      throw new BadRequestException('当前状态不能退款')
    }

    const requested = dto.items?.length
      ? dto.items
      : order.items
          .map((item) => ({
            orderItemId: item.id,
            quantity: item.quantity - item.refundedQuantity,
          }))
          .filter((item) => item.quantity > 0)
    if (requested.length === 0) {
      throw new BadRequestException('没有可退款数量')
    }

    const refunded = await this.prisma.$transaction(async (tx) => {
      let refundedNow = 0
      const refundedQuantityByItem = new Map<string, number>()

      for (const input of requested) {
        const item = order.items.find((entry) => entry.id === input.orderItemId)
        if (!item) {
          throw new BadRequestException('退款商品不属于该订单')
        }
        const remaining = item.quantity - item.refundedQuantity
        if (input.quantity <= 0 || input.quantity > remaining) {
          throw new BadRequestException('退款数量超过可退数量')
        }

        const cumulativeQuantity = item.refundedQuantity + input.quantity
        const cumulativeAmount = Math.round((item.amountCents * cumulativeQuantity) / item.quantity)
        const amountCents = cumulativeAmount - item.refundedAmountCents

        await tx.salesOrderItem.update({
          where: { id: item.id },
          data: {
            refundedQuantity: { increment: input.quantity },
            refundedAmountCents: { increment: amountCents },
          },
        })
        await tx.salesRefund.create({
          data: {
            orderId: id,
            orderItemId: item.id,
            quantity: input.quantity,
            amountCents,
            reason: dto.reason,
            operatorId: actor.sub,
          },
        })
        await this.releaseStock(tx, item.id, input.quantity)
        await this.commissionsService.reverseForRefundInTransaction(
          tx,
          item.id,
          cumulativeQuantity,
          item.quantity,
        )
        await this.statementsService.addRefundAdjustmentInTransaction(
          tx,
          item.id,
          cumulativeQuantity,
          item.quantity,
        )
        // 商家收入行同步冲回：先按累计净额重算结算，再对已入对账单的行做差额冲回
        const { settlementId, currentIncome } =
          await this.commissionsService.recomputeSettlementForItemInTransaction(tx, item.id)
        await this.statementsService.addSettlementRefundAdjustmentInTransaction(
          tx,
          settlementId,
          currentIncome,
        )
        refundedQuantityByItem.set(item.id, cumulativeQuantity)
        refundedNow += amountCents
      }

      const fullyRefunded = order.items.every((item) => {
        const total =
          (refundedQuantityByItem.get(item.id) ?? item.refundedQuantity) === item.quantity
        return total
      })

      return tx.salesOrder.update({
        where: { id },
        data: {
          refundedAmountCents: { increment: refundedNow },
          status: fullyRefunded
            ? PrismaSalesOrderStatus.refunded
            : PrismaSalesOrderStatus.after_sale,
        },
        include: { items: true, refunds: true },
      })
    })
    await this.auditService.record({
      actor,
      action: 'order.refund',
      resourceType: 'order',
      resourceId: order.id,
      orderId: order.id,
      orderNo: order.orderNo,
      customerId: order.customerId,
      channelId: order.attributedChannelId ?? order.preAttributionChannelId,
      merchantId: order.merchantId,
      detail: {
        reason: dto.reason,
        requested,
        refundedAmountCents: refunded.refundedAmountCents,
        status: refunded.status,
      },
    })
    await this.auditService.record({
      actor,
      action: 'commission.reverse',
      resourceType: 'commission',
      resourceId: order.id,
      orderId: order.id,
      orderNo: order.orderNo,
      customerId: order.customerId,
      merchantId: order.merchantId,
      detail: { reason: dto.reason, requested },
    })
    await this.evaluateChannelRefundRate(order)
    return refunded
  }

  private async evaluateChannelRefundRate(order: {
    attributedChannelId: string | null
    preAttributionChannelId: string | null
  }): Promise<void> {
    const channelId = order.attributedChannelId ?? order.preAttributionChannelId
    if (!channelId) {
      return
    }
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthOrders = await this.prisma.salesOrder.findMany({
      where: {
        paidAt: { gte: monthStart },
        OR: [
          { attributedChannelId: channelId },
          { attributedChannelId: null, preAttributionChannelId: channelId },
        ],
      },
      select: { id: true, totalAmountCents: true },
    })
    const paidCents = monthOrders.reduce((sum, item) => sum + item.totalAmountCents, 0)
    if (paidCents === 0) {
      return
    }
    const refunds = await this.prisma.salesRefund.findMany({
      where: {
        orderId: { in: monthOrders.map((item) => item.id) },
        createdAt: { gte: monthStart },
      },
    })
    const refundedCents = refunds.reduce((sum, item) => sum + item.amountCents, 0)
    const rate = refundedCents / paidCents
    if (rate > 0.2) {
      await this.channelsService.pauseForRefundRate(channelId, `${(rate * 100).toFixed(1)}%`)
    }
  }

  async closeExpired() {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000)
    const result = await this.prisma.salesOrder.updateMany({
      where: {
        status: PrismaSalesOrderStatus.pending_payment,
        createdAt: { lt: cutoff },
      },
      data: { status: PrismaSalesOrderStatus.cancelled },
    })
    return { closed: result.count }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async closeExpiredCron(): Promise<void> {
    await this.closeExpired()
  }

  private async releaseStock(
    tx: Prisma.TransactionClient,
    orderItemId: string,
    quantity: number,
  ): Promise<void> {
    const allocations = await tx.salesStockAllocation.findMany({
      where: { orderItemId },
      orderBy: { id: 'asc' },
    })
    let needed = quantity
    for (const allocation of allocations) {
      if (needed <= 0) {
        break
      }
      const available = allocation.quantity - allocation.releasedQuantity
      const take = Math.min(needed, available)
      if (take <= 0) {
        continue
      }
      await tx.batch.update({
        where: { id: allocation.batchId },
        data: { remaining: { increment: take } },
      })
      await tx.salesStockAllocation.update({
        where: { id: allocation.id },
        data: { releasedQuantity: { increment: take } },
      })
      needed -= take
    }
  }

  private assertAccess(
    order: { merchantId: string; customerId: string },
    actor: AuthUser,
  ): void {
    if (actor.roles.includes(Role.PLATFORM)) {
      return
    }
    if (actor.roles.includes(Role.MERCHANT) && order.merchantId === actor.sub) {
      return
    }
    if (actor.roles.includes(Role.CUSTOMER) && order.customerId === actor.sub) {
      return
    }
    if (actor.roles.includes(Role.LAB)) {
      return
    }
    throw new ForbiddenException('无权查看该销售单')
  }

  private generateOrderNo(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return `XS${date}${randomBytes(3).toString('hex').toUpperCase()}`
  }
}
