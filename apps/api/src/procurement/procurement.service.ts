import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  Prisma,
  ProcurementStatus as PrismaProcurementStatus,
  Role as PrismaRole,
} from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { Role } from '@mall/shared'
import { BoxCodesService } from '../box-codes/box-codes.service'
import { ContractsService } from '../contracts/contracts.service'
import { NotificationsService } from '../notifications/notifications.service'
import { PrepaidService } from '../prepaid/prepaid.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateProcurementDto } from './dto/create-procurement.dto'
import type { AuthUser } from '../auth/auth-user.type'

const RELATED_TYPE = 'procurement_order'

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prepaidService: PrepaidService,
    private readonly contractsService: ContractsService,
    private readonly boxCodesService: BoxCodesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(actor: AuthUser, dto: CreateProcurementDto) {
    if (!actor.roles.includes(Role.MERCHANT)) {
      throw new ForbiddenException('只有商家可以提交采购单')
    }
    await this.contractsService.assertMerchantCanList(actor.sub)

    const productIds = [...new Set(dto.items.map((item) => item.productId))]
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } })
    if (products.length !== productIds.length) {
      throw new BadRequestException('采购商品不存在')
    }
    const supplierIds = new Set(products.map((product) => product.supplierId))
    if (supplierIds.size > 1) {
      throw new BadRequestException('同一采购单只能包含同一供应商的商品')
    }
    if (products.some((product) => product.status !== 'active')) {
      throw new BadRequestException('存在未上架商品，无法采购')
    }
    const supplierId = products[0].supplierId
    await this.contractsService.assertSupplierCanSupply(supplierId)

    const orderNo = this.generateOrderNo()

    const created = await this.prisma.$transaction(async (tx) => {
      const now = new Date()
      let totalAmountCents = 0
      const itemRows: Array<{
        productId: string
        productName: string
        skuCode: string
        batchId: string
        batchNo: string
        supplyPriceCents: number
        quantity: number
        amountCents: number
      }> = []

      for (const input of dto.items) {
        const product = products.find((item) => item.id === input.productId)
        if (!product) {
          throw new BadRequestException('采购商品不存在')
        }
        const batches = await tx.batch.findMany({
          where: {
            productId: product.id,
            remaining: { gt: 0 },
            expiresAt: { gt: now },
          },
          orderBy: [{ expiresAt: 'asc' }, { productionDate: 'asc' }],
        })
        const stock = batches.reduce((sum, batch) => sum + batch.remaining, 0)
        if (stock < input.quantity) {
          throw new BadRequestException(`库存不足：${product.name} 当前可用 ${stock} 盒`)
        }

        let needed = input.quantity
        for (const batch of batches) {
          if (needed <= 0) {
            break
          }
          const take = Math.min(needed, batch.remaining)
          await tx.batch.update({
            where: { id: batch.id },
            data: { remaining: { decrement: take } },
          })
          const amountCents = take * product.supplyPriceCents
          itemRows.push({
            productId: product.id,
            productName: product.name,
            skuCode: product.skuCode,
            batchId: batch.id,
            batchNo: batch.batchNo,
            supplyPriceCents: product.supplyPriceCents,
            quantity: take,
            amountCents,
          })
          totalAmountCents += amountCents
          needed -= take
        }
      }

      const order = await tx.procurementOrder.create({
        data: {
          orderNo,
          merchantId: actor.sub,
          supplierId,
          status: PrismaProcurementStatus.deducted,
          totalAmountCents,
          remark: dto.remark,
          items: { create: itemRows },
        },
        include: {
          items: true,
          supplier: { select: { id: true, name: true, organization: true } },
        },
      })

      await this.prepaidService.reserveInTransaction(
        tx,
        actor.sub,
        totalAmountCents,
        RELATED_TYPE,
        order.id,
        actor.sub,
      )

      return order
    })
    const account = await this.prisma.prepaidAccount.findUnique({
      where: { merchantId: actor.sub },
    })
    if (account && account.availableCents < 100000) {
      await this.notificationsService.emit({
        type: 'prepaid_low_balance',
        recipientId: actor.sub,
        recipientRole: Role.MERCHANT,
        subjectType: 'prepaid_account',
        subjectId: account.id,
        title: '预付款余额不足',
        body: `当前可用余额 ${(account.availableCents / 100).toFixed(2)} 元，低于 1000 元，请及时充值以免影响采购。`,
        templateCode: 'prepaid_low_balance',
        dedupeKey: `prepaid_low_balance:${account.id}:${new Date().toISOString().slice(0, 10)}`,
        payload: { availableCents: account.availableCents },
      })
    }
    return created
  }

  async list(actor: AuthUser) {
    const where: Prisma.ProcurementOrderWhereInput = actor.roles.includes(Role.PLATFORM)
      ? {}
      : actor.roles.includes(Role.MERCHANT)
        ? { merchantId: actor.sub }
        : actor.roles.includes(Role.SUPPLIER)
          ? { supplierId: actor.sub }
          : { id: '__none__' }

    return this.prisma.procurementOrder.findMany({
      where,
      include: {
        items: true,
        supplier: { select: { id: true, name: true, organization: true } },
        merchant: { select: { id: true, name: true, organization: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getOne(id: string, actor: AuthUser) {
    const order = await this.prisma.procurementOrder.findUnique({
      where: { id },
      include: {
        items: true,
        supplier: { select: { id: true, name: true, organization: true } },
        merchant: { select: { id: true, name: true, organization: true } },
      },
    })
    if (!order) {
      throw new NotFoundException('采购单不存在')
    }
    this.assertAccess(order, actor)
    return order
  }

  async confirm(id: string, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (!actor.roles.includes(Role.PLATFORM) && order.supplierId !== actor.sub) {
      throw new ForbiddenException('只有供应商可以确认采购单')
    }
    if (order.status !== PrismaProcurementStatus.deducted) {
      throw new BadRequestException('当前状态不能确认')
    }
    return this.prisma.procurementOrder.update({
      where: { id },
      data: { status: PrismaProcurementStatus.pending_shipment },
    })
  }

  async ship(id: string, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (!actor.roles.includes(Role.PLATFORM) && order.supplierId !== actor.sub) {
      throw new ForbiddenException('只有供应商可以发货')
    }
    if (order.status !== PrismaProcurementStatus.pending_shipment) {
      throw new BadRequestException('当前状态不能发货')
    }
    return this.prisma.procurementOrder.update({
      where: { id },
      data: { status: PrismaProcurementStatus.shipped },
    })
  }

  async receive(id: string, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (order.merchantId !== actor.sub) {
      throw new ForbiddenException('只有采购商家可以确认收货')
    }
    if (order.status !== PrismaProcurementStatus.shipped) {
      throw new BadRequestException('当前状态不能确认收货')
    }

    return this.prisma.$transaction(async (tx) => {
      await this.prepaidService.settleFrozenInTransaction(
        tx,
        order.merchantId,
        order.totalAmountCents,
        RELATED_TYPE,
        order.id,
        actor.sub,
      )
      return tx.procurementOrder.update({
        where: { id },
        data: { status: PrismaProcurementStatus.received },
      })
    })
  }

  async complete(id: string, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (order.status !== PrismaProcurementStatus.received) {
      throw new BadRequestException('当前状态不能完成')
    }
    return this.prisma.procurementOrder.update({
      where: { id },
      data: { status: PrismaProcurementStatus.completed },
    })
  }

  async cancel(id: string, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (order.merchantId !== actor.sub) {
      throw new ForbiddenException('只有采购商家可以取消')
    }
    if (
      order.status !== PrismaProcurementStatus.deducted &&
      order.status !== PrismaProcurementStatus.pending_shipment
    ) {
      throw new BadRequestException('已发货的采购单不能直接取消')
    }

    return this.prisma.$transaction(async (tx) => {
      await this.prepaidService.releaseFrozenInTransaction(
        tx,
        order.merchantId,
        order.totalAmountCents,
        RELATED_TYPE,
        order.id,
        actor.sub,
      )
      await this.restock(tx, order.items)
      await this.boxCodesService.voidForOrderInTransaction(tx, order.id, '采购单取消')
      return tx.procurementOrder.update({
        where: { id },
        data: { status: PrismaProcurementStatus.cancelled },
      })
    })
  }

  async refund(id: string, actor: AuthUser) {
    const order = await this.getOne(id, actor)
    if (
      order.status !== PrismaProcurementStatus.received &&
      order.status !== PrismaProcurementStatus.completed
    ) {
      throw new BadRequestException('当前状态不能退款')
    }

    return this.prisma.$transaction(async (tx) => {
      await this.prepaidService.refundDeductedInTransaction(
        tx,
        order.merchantId,
        order.totalAmountCents,
        RELATED_TYPE,
        order.id,
        actor.sub,
      )
      await this.restock(tx, order.items)
      await this.boxCodesService.voidForOrderInTransaction(tx, order.id, '采购单退款')
      return tx.procurementOrder.update({
        where: { id },
        data: { status: PrismaProcurementStatus.refunded },
      })
    })
  }

  private async restock(
    tx: Prisma.TransactionClient,
    items: Array<{ batchId: string; quantity: number }>,
  ) {
    for (const item of items) {
      await tx.batch.update({
        where: { id: item.batchId },
        data: { remaining: { increment: item.quantity } },
      })
    }
  }

  private assertAccess(
    order: { merchantId: string; supplierId: string },
    actor: AuthUser,
  ): void {
    if (actor.roles.includes(Role.PLATFORM)) {
      return
    }
    if (order.merchantId === actor.sub || order.supplierId === actor.sub) {
      return
    }
    throw new ForbiddenException('无权查看该采购单')
  }

  private generateOrderNo(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return `CG${date}${randomBytes(3).toString('hex').toUpperCase()}`
  }
}
