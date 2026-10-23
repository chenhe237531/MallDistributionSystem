import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { ForwardReportDto } from './dto/notification.dto'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.notificationsService.listMine(user)
  }

  @Get('report-tasks')
  @Roles(Role.MERCHANT, Role.PLATFORM)
  reportTasks(@CurrentUser() user: AuthUser) {
    return this.notificationsService.reportTasks(user)
  }

  @Post('report-tasks/scan')
  @Roles(Role.PLATFORM)
  scanOverdue() {
    return this.notificationsService.scanOverdue()
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.markRead(id, user)
  }
}

@Controller('report-shares')
export class ReportSharesController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @Roles(Role.MERCHANT)
  forward(@Body() dto: ForwardReportDto, @CurrentUser() user: AuthUser) {
    return this.notificationsService.forwardReport(dto.reportId, dto, user)
  }

  @Get(':token')
  open(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.openShare(token, user)
  }
}
