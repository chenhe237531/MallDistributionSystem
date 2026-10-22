import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { Public } from '../common/public.decorator'
import { BoxCodesService } from './box-codes.service'
import { GenerateBoxCodesDto, VoidBoxCodeDto } from './dto/box-code.dto'

@Controller('box-codes')
export class BoxCodesController {
  constructor(private readonly boxCodesService: BoxCodesService) {}

  @Post('generate')
  @Roles(Role.PLATFORM)
  generate(@Body() dto: GenerateBoxCodesDto, @CurrentUser() user: AuthUser) {
    return this.boxCodesService.generate(dto.procurementOrderId, user)
  }

  @Post('freeze-unactivated')
  @Roles(Role.PLATFORM)
  freezeUnactivated(@Body('channelId') channelId: string, @CurrentUser() user: AuthUser) {
    return this.boxCodesService.freezeUnactivated(channelId, user)
  }

  @Get('labels/:procurementOrderId')
  @Roles(Role.PLATFORM, Role.MERCHANT)
  labels(@Param('procurementOrderId') procurementOrderId: string, @CurrentUser() user: AuthUser) {
    return this.boxCodesService.labels(procurementOrderId, user)
  }

  @Public()
  @Get('resolve/:code')
  resolve(@Param('code') code: string) {
    return this.boxCodesService.resolve(code)
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.boxCodesService.list(user, status)
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.boxCodesService.getOne(id, user)
  }

  @Post(':id/void')
  @Roles(Role.PLATFORM)
  void(@Param('id') id: string, @Body() dto: VoidBoxCodeDto, @CurrentUser() user: AuthUser) {
    return this.boxCodesService.void(id, dto, user)
  }

  @Post(':id/replace')
  @Roles(Role.PLATFORM)
  replace(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.boxCodesService.replace(id, user)
  }
}
