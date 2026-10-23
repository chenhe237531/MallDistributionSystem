import { Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { AlertsService } from './alerts.service'

@Controller('alerts')
@Roles(Role.PLATFORM)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  list(@Query('status') status?: string, @Query('type') type?: string) {
    return this.alertsService.list(status, type)
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.alertsService.resolve(id, user)
  }
}
