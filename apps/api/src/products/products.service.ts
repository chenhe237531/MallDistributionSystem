import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  Prisma,
  ProductStatus as PrismaProductStatus,
  Role as PrismaRole,
} from '@prisma/client'
import { Role } from '@mall/shared'
import { ContractsService } from '../contracts/contracts.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateBatchDto } from './dto/create-batch.dto'
import { CreateListingDto } from './dto/create-listing.dto'
import { CreateProductDto } from './dto/create-product.dto'
import { ReviewProductDto } from './dto/review-product.dto'
import { UpdateListingDto } from './dto/update-listing.dto'
import { UpdateProductContentDto } from './dto/update-product-content.dto'
import type { AuthUser } from '../auth/auth-user.type'

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
  ) {}

  async create(actor: AuthUser, dto: CreateProductDto) {
    if (!actor.roles.includes(Role.SUPPLIER)) {
      throw new ForbiddenException('只有供应商可以创建商品')
    }
    const supplier = await this.prisma.user.findUnique({ where: { id: actor.sub } })
    if (!supplier) {
      throw new NotFoundException('供应商账号不存在')
    }
    const existing = await this.prisma.product.findUnique({ where: { skuCode: dto.skuCode } })
    if (existing) {
      throw new ConflictException('SKU 编码已存在')
    }

    return this.prisma.product.create({
      data: {
        skuCode: dto.skuCode,
        name: dto.name,
        supplierId: actor.sub,
        testItems: dto.testItems,
        sampleType: dto.sampleType,
        samplingMethod: dto.samplingMethod,
        storageCondition: dto.storageCondition,
        shelfLifeDays: dto.shelfLifeDays,
        questionnaireFields: dto.questionnaireFields ?? undefined,
        supplyPriceCents: dto.supplyPriceCents,
        suggestedRetailPriceCents: dto.suggestedRetailPriceCents,
        distributable: dto.distributable ?? false,
        status: PrismaProductStatus.draft,
      },
    })
  }

  async list(actor: AuthUser) {
    const isPlatform = actor.roles.includes(Role.PLATFORM)
    const isSupplier = actor.roles.includes(Role.SUPPLIER)
    const where = isPlatform
      ? {}
      : isSupplier
        ? { supplierId: actor.sub }
        : { status: PrismaProductStatus.active }

    return this.prisma.product.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, organization: true } },
        batches: { orderBy: { expiresAt: 'asc' } },
        listings: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, organization: true } },
        batches: { orderBy: { expiresAt: 'asc' } },
        listings: true,
        relatedLinks: {
          orderBy: { sort: 'asc' },
          select: { related: { select: { id: true, name: true, skuCode: true } } },
        },
        courseBindings: {
          select: { course: { select: { id: true, name: true, category: true } } },
        },
      },
    })
    if (!product) {
      throw new NotFoundException('商品不存在')
    }
    return {
      ...product,
      relatedProducts: product.relatedLinks.map((link) => link.related),
      boundCourses: product.courseBindings.map((binding) => binding.course),
    }
  }

  /**
   * 平台运营配置商品内容：视频/介绍文案 + 关联商品与绑定课程（全量替换语义）。
   */
  async updateContent(id: string, dto: UpdateProductContentDto) {
    const product = await this.prisma.product.findUnique({ where: { id } })
    if (!product) {
      throw new NotFoundException('商品不存在')
    }
    const relatedProductIds = dto.relatedProductIds ?? []
    if (relatedProductIds.includes(id)) {
      throw new BadRequestException('商品不能关联自身')
    }
    if (relatedProductIds.length > 0) {
      const relatedCount = await this.prisma.product.count({
        where: { id: { in: relatedProductIds } },
      })
      if (relatedCount !== relatedProductIds.length) {
        throw new BadRequestException('存在无效的关联商品')
      }
    }
    const boundCourseIds = dto.boundCourseIds ?? []
    if (boundCourseIds.length > 0) {
      const courseCount = await this.prisma.course.count({
        where: { id: { in: boundCourseIds } },
      })
      if (courseCount !== boundCourseIds.length) {
        throw new BadRequestException('存在无效的绑定课程')
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          guideVideoUrl: dto.guideVideoUrl,
          intro: dto.intro,
        },
      })
      if (dto.relatedProductIds !== undefined) {
        await tx.productRelated.deleteMany({ where: { productId: id } })
        if (relatedProductIds.length > 0) {
          await tx.productRelated.createMany({
            data: relatedProductIds.map((relatedProductId, index) => ({
              productId: id,
              relatedProductId,
              sort: index,
            })),
          })
        }
      }
      if (dto.boundCourseIds !== undefined) {
        await tx.productCourse.deleteMany({ where: { productId: id } })
        if (boundCourseIds.length > 0) {
          await tx.productCourse.createMany({
            data: boundCourseIds.map((courseId) => ({ productId: id, courseId })),
          })
        }
      }
      return updated
    })
  }

  async review(id: string, dto: ReviewProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } })
    if (!product) {
      throw new NotFoundException('商品不存在')
    }
    if (product.supplyPriceCents > dto.retailPriceCents) {
      throw new BadRequestException('零售价不能低于供货价')
    }
    if (dto.platformServiceRateBps + dto.commissionRateCapBps > 10000) {
      throw new BadRequestException('平台服务费率与佣金上限之和不能超过 100%')
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        retailPriceCents: dto.retailPriceCents,
        platformServiceRateBps: dto.platformServiceRateBps,
        commissionRateCapBps: dto.commissionRateCapBps,
        distributable: dto.distributable,
        status: dto.status as unknown as PrismaProductStatus,
      },
    })
  }

  async createListing(actor: AuthUser, dto: CreateListingDto) {
    if (!actor.roles.includes(Role.MERCHANT)) {
      throw new ForbiddenException('只有商家可以选品上架')
    }
    await this.contractsService.assertMerchantCanList(actor.sub)

    const merchant = await this.prisma.user.findUnique({ where: { id: actor.sub } })
    if (!merchant?.organizationId) {
      throw new BadRequestException('商家未绑定组织')
    }
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } })
    if (!product || product.status !== PrismaProductStatus.active) {
      throw new BadRequestException('商品未上架或不存在')
    }
    if (!product.distributable) {
      throw new BadRequestException('该商品不允许分销')
    }
    if (!product.retailPriceCents || dto.retailPriceCents < product.retailPriceCents) {
      throw new BadRequestException('售价不能低于平台底价')
    }

    const existing = await this.prisma.merchantProduct.findUnique({
      where: { merchantId_productId: { merchantId: actor.sub, productId: product.id } },
    })
    if (existing) {
      throw new ConflictException('该商品已在本店上架')
    }

    return this.prisma.merchantProduct.create({
      data: {
        merchantId: actor.sub,
        productId: product.id,
        retailPriceCents: dto.retailPriceCents,
      },
      include: { product: true },
    })
  }

  async myListings(actor: AuthUser) {
    return this.prisma.merchantProduct.findMany({
      where: { merchantId: actor.sub },
      include: {
        product: {
          include: {
            batches: { orderBy: { expiresAt: 'asc' } },
            supplier: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async updateListing(actor: AuthUser, listingId: string, dto: UpdateListingDto) {
    const listing = await this.prisma.merchantProduct.findUnique({
      where: { id: listingId },
      include: { product: true },
    })
    if (!listing) {
      throw new NotFoundException('上架记录不存在')
    }
    if (listing.merchantId !== actor.sub && !actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('无权修改该上架记录')
    }
    if (
      dto.retailPriceCents !== undefined &&
      listing.product.retailPriceCents &&
      dto.retailPriceCents < listing.product.retailPriceCents
    ) {
      throw new BadRequestException('售价不能低于平台底价')
    }

    return this.prisma.merchantProduct.update({
      where: { id: listingId },
      data: {
        retailPriceCents: dto.retailPriceCents,
        status: dto.status,
      },
      include: { product: true },
    })
  }

  async createBatch(actor: AuthUser, productId: string, dto: CreateBatchDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      throw new NotFoundException('商品不存在')
    }
    if (product.supplierId !== actor.sub) {
      throw new ForbiddenException('只能为自己的商品创建批次')
    }
    await this.contractsService.assertSupplierCanSupply(actor.sub)

    const productionDate = new Date(dto.productionDate)
    const expiresAt = new Date(dto.expiresAt)
    if (expiresAt <= productionDate) {
      throw new BadRequestException('有效期必须晚于生产日期')
    }
    const existing = await this.prisma.batch.findUnique({
      where: { productId_batchNo: { productId, batchNo: dto.batchNo } },
    })
    if (existing) {
      throw new ConflictException('批次号已存在')
    }

    return this.prisma.batch.create({
      data: {
        productId,
        batchNo: dto.batchNo,
        productionDate,
        expiresAt,
        quantity: dto.quantity,
        remaining: dto.quantity,
      },
    })
  }

  async inventory(productId: string) {
    const now = new Date()
    const batches = await this.prisma.batch.findMany({
      where: { productId, remaining: { gt: 0 } },
      orderBy: [{ expiresAt: 'asc' }, { productionDate: 'asc' }],
    })
    const available = batches
      .filter((batch) => batch.expiresAt > now)
      .reduce((total, batch) => total + batch.remaining, 0)
    const expired = batches
      .filter((batch) => batch.expiresAt <= now)
      .reduce((total, batch) => total + batch.remaining, 0)

    return {
      available,
      expired,
      batches: batches.map((batch) => ({ ...batch, expired: batch.expiresAt <= now })),
    }
  }

  /**
   * 按先进先出扣减批次库存，过期批次不参与分配。
   * 供出库生成盒码时调用。
   */
  async allocateStock(productId: string, quantity: number) {
    return this.prisma.$transaction((tx) =>
      this.allocateStockInTransaction(tx, productId, quantity),
    )
  }

  async allocateStockInTransaction(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
  ) {
    const batches = await tx.batch.findMany({
      where: { productId, remaining: { gt: 0 }, expiresAt: { gt: new Date() } },
      orderBy: [{ expiresAt: 'asc' }, { productionDate: 'asc' }],
    })
    const total = batches.reduce((sum, batch) => sum + batch.remaining, 0)
    if (total < quantity) {
      throw new BadRequestException('库存不足，无法出库')
    }

    let needed = quantity
    const allocations: Array<{ batchId: string; batchNo: string; quantity: number }> = []
    for (const batch of batches) {
      if (needed <= 0) {
        break
      }
      const take = Math.min(needed, batch.remaining)
      await tx.batch.update({
        where: { id: batch.id },
        data: { remaining: { decrement: take } },
      })
      allocations.push({ batchId: batch.id, batchNo: batch.batchNo, quantity: take })
      needed -= take
    }
    return allocations
  }
}
