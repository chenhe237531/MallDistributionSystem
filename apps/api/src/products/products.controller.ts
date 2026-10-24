import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { AllocateStockDto } from './dto/allocate-stock.dto'
import { CreateBatchDto } from './dto/create-batch.dto'
import { CreateListingDto } from './dto/create-listing.dto'
import { CreateProductDto } from './dto/create-product.dto'
import { ReviewProductDto } from './dto/review-product.dto'
import { UpdateListingDto } from './dto/update-listing.dto'
import { UpdateProductContentDto } from './dto/update-product-content.dto'
import { ProductsService } from './products.service'

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.productsService.list(user)
  }

  @Get('merchant/mine')
  @Roles(Role.MERCHANT)
  myListings(@CurrentUser() user: AuthUser) {
    return this.productsService.myListings(user)
  }

  @Post('merchant/listings')
  @Roles(Role.MERCHANT)
  createListing(@CurrentUser() user: AuthUser, @Body() dto: CreateListingDto) {
    return this.productsService.createListing(user, dto)
  }

  @Patch('merchant/listings/:id')
  @Roles(Role.MERCHANT)
  updateListing(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.productsService.updateListing(user, id, dto)
  }

  @Post()
  @Roles(Role.SUPPLIER)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user, dto)
  }

  @Post(':id/review')
  @Roles(Role.PLATFORM)
  review(@Param('id') id: string, @Body() dto: ReviewProductDto) {
    return this.productsService.review(id, dto)
  }

  @Patch(':id/content')
  @Roles(Role.PLATFORM)
  updateContent(@Param('id') id: string, @Body() dto: UpdateProductContentDto) {
    return this.productsService.updateContent(id, dto)
  }

  @Post(':id/batches')
  @Roles(Role.SUPPLIER)
  createBatch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateBatchDto,
  ) {
    return this.productsService.createBatch(user, id, dto)
  }

  @Post(':id/allocate')
  @Roles(Role.PLATFORM)
  allocate(@Param('id') id: string, @Body() dto: AllocateStockDto) {
    return this.productsService.allocateStock(id, dto.quantity)
  }

  @Get(':id/batches')
  async batches(@Param('id') id: string) {
    return (await this.productsService.getOne(id)).batches
  }

  @Get(':id/inventory')
  inventory(@Param('id') id: string) {
    return this.productsService.inventory(id)
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.productsService.getOne(id)
  }
}
