import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { Public } from '../common/public.decorator'
import {
  CreateSalesOrderDto,
  RefundSalesOrderDto,
  RegisterPaymentDto,
} from './dto/sales-order.dto'
import { SalesOrdersService } from './sales-orders.service'

@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly salesOrdersService: SalesOrdersService) {}

  @Public()
  @Get('storefront')
  storefront(@Query('channelCode') channelCode?: string) {
    return this.salesOrdersService.storefront(channelCode)
  }

  @Post()
  @Roles(Role.CUSTOMER)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSalesOrderDto) {
    return this.salesOrdersService.create(user, dto)
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.salesOrdersService.list(user)
  }

  @Post('close-expired')
  @Roles(Role.PLATFORM)
  closeExpired() {
    return this.salesOrdersService.closeExpired()
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesOrdersService.getOne(id, user)
  }

  @Post(':id/register-payment')
  @Roles(Role.MERCHANT, Role.PLATFORM)
  registerPayment(
    @Param('id') id: string,
    @Body() dto: RegisterPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesOrdersService.registerPayment(id, dto.paidAmountCents, user)
  }

  @Post(':id/ship')
  @Roles(Role.MERCHANT, Role.PLATFORM)
  ship(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesOrdersService.ship(id, user)
  }

  @Post(':id/deliver')
  @Roles(Role.MERCHANT, Role.PLATFORM)
  deliver(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesOrdersService.deliver(id, user)
  }

  @Post(':id/mark-testing')
  @Roles(Role.LAB, Role.PLATFORM)
  markTesting(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesOrdersService.markTesting(id, user)
  }

  @Post(':id/mark-report-ready')
  @Roles(Role.LAB, Role.PLATFORM)
  markReportReady(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesOrdersService.markReportReady(id, user)
  }

  @Post(':id/complete')
  @Roles(Role.MERCHANT, Role.PLATFORM)
  complete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesOrdersService.complete(id, user)
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesOrdersService.cancel(id, user)
  }

  @Post(':id/refund')
  @Roles(Role.MERCHANT, Role.PLATFORM)
  refund(
    @Param('id') id: string,
    @Body() dto: RefundSalesOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesOrdersService.refund(id, dto, user)
  }
}
