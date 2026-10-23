import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import {
  AdjustPrepaidDto,
  CreateRechargeDto,
  CreditRechargeDto,
  LockPrepaidDto,
  RejectRechargeDto,
} from './dto/prepaid.dto'
import { PrepaidService } from './prepaid.service'

@Controller('prepaid')
export class PrepaidController {
  constructor(private readonly prepaidService: PrepaidService) {}

  @Get('me')
  @Roles(Role.MERCHANT)
  me(@CurrentUser() user: AuthUser) {
    return this.prepaidService.me(user.sub)
  }

  @Get('entries')
  @Roles(Role.MERCHANT)
  entries(@CurrentUser() user: AuthUser) {
    return this.prepaidService.entries(user.sub)
  }

  @Get('recharges')
  listRecharges(@CurrentUser() user: AuthUser) {
    const isPlatform = user.roles.includes(Role.PLATFORM)
    return this.prepaidService.listRecharges(isPlatform ? undefined : user.sub)
  }

  @Post('recharges')
  @Roles(Role.MERCHANT)
  createRecharge(@CurrentUser() user: AuthUser, @Body() dto: CreateRechargeDto) {
    return this.prepaidService.createRecharge(user.sub, dto)
  }

  @Post('recharges/:id/credit')
  @Roles(Role.PLATFORM)
  credit(
    @Param('id') id: string,
    @Body() dto: CreditRechargeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prepaidService.credit(id, dto, user.sub)
  }

  @Post('recharges/:id/reject')
  @Roles(Role.PLATFORM)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectRechargeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prepaidService.reject(id, dto, user.sub)
  }

  @Post('adjust')
  @Roles(Role.PLATFORM)
  adjust(@Body() dto: AdjustPrepaidDto, @CurrentUser() user: AuthUser) {
    return this.prepaidService.adjust(dto, user.sub)
  }

  @Post('lock')
  @Roles(Role.PLATFORM)
  lock(@Body() dto: LockPrepaidDto, @CurrentUser() user: AuthUser) {
    return this.prepaidService.lock(dto, user.sub)
  }

  @Post('unlock')
  @Roles(Role.PLATFORM)
  unlock(@Body() dto: LockPrepaidDto) {
    return this.prepaidService.unlock(dto.merchantId)
  }

  @Get('accounts')
  @Roles(Role.PLATFORM)
  accounts() {
    return this.prepaidService.listAccounts()
  }
}
