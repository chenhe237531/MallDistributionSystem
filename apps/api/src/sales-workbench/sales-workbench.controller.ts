import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { AssignSalesDto, CreateClaimDto } from './dto/workbench.dto'
import { SalesWorkbenchService } from './sales-workbench.service'

@Controller('sales-workbench')
export class SalesWorkbenchController {
  constructor(private readonly service: SalesWorkbenchService) {}

  @Get('customers')
  @Roles(Role.SALES)
  customers(@CurrentUser() user: AuthUser) {
    return this.service.customersForSales(user.sub)
  }

  @Get('performance')
  @Roles(Role.SALES)
  performance(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.performance(user.sub, from, to)
  }

  @Post('claims')
  @Roles(Role.SALES)
  createClaim(@CurrentUser() user: AuthUser, @Body() dto: CreateClaimDto) {
    return this.service.createClaim(user, dto)
  }

  @Get('claims')
  claims(@CurrentUser() user: AuthUser) {
    return this.service.listClaims(user)
  }

  @Post('claims/:id/confirm')
  confirmClaim(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.resolveClaim(id, user, true)
  }

  @Post('claims/:id/reject')
  rejectClaim(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.resolveClaim(id, user, false)
  }

  @Get('merchant/customers')
  @Roles(Role.MERCHANT)
  merchantCustomers(@CurrentUser() user: AuthUser) {
    return this.service.merchantCustomers(user.sub)
  }

  @Post('merchant/customers/:customerId/assign')
  @Roles(Role.MERCHANT)
  assign(
    @Param('customerId') customerId: string,
    @Body() dto: AssignSalesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.assignSales(user.sub, customerId, dto)
  }
}
