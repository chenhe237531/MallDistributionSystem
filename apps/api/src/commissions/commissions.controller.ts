import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { CommissionsService } from './commissions.service'
import { CreateCommissionRuleDto } from './dto/create-rule.dto'

@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Post('rules')
  @Roles(Role.PLATFORM)
  createRule(@Body() dto: CreateCommissionRuleDto) {
    return this.commissionsService.createRule(dto)
  }

  @Get('rules')
  @Roles(Role.PLATFORM)
  rules(@Query('productId') productId?: string) {
    return this.commissionsService.listRules(productId)
  }

  @Post('confirm-eligible')
  @Roles(Role.PLATFORM)
  confirmEligible() {
    return this.commissionsService.confirmEligible()
  }

  @Get('me')
  @Roles(Role.PARTNER)
  mine(@CurrentUser() user: AuthUser) {
    return this.commissionsService.list(user)
  }

  @Get('order/:orderId/split')
  orderSplit(@Param('orderId') orderId: string, @CurrentUser() user: AuthUser) {
    return this.commissionsService.orderSplit(orderId, user)
  }

  @Get('order/:orderId')
  orderCommissions(@Param('orderId') orderId: string, @CurrentUser() user: AuthUser) {
    return this.commissionsService.orderCommissions(orderId, user)
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.commissionsService.list(user)
  }
}
