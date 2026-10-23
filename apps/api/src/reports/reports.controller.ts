import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { CorrectReportDto, CreateReportDto } from './dto/report.dto'
import { ReportsService } from './reports.service'

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @Roles(Role.LAB, Role.PLATFORM)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user, dto)
  }

  @Get('me/views')
  @Roles(Role.CUSTOMER)
  myViews(@CurrentUser() user: AuthUser) {
    return this.reportsService.myViews(user.sub)
  }

  @Get('sample/:sampleId/latest')
  latestBySample(@Param('sampleId') sampleId: string, @CurrentUser() user: AuthUser) {
    return this.reportsService.latestBySample(sampleId, user)
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.reportsService.list(user)
  }

  @Post(':id/submit')
  @Roles(Role.LAB, Role.PLATFORM)
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reportsService.submit(id, user)
  }

  @Post(':id/publish')
  @Roles(Role.PLATFORM)
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reportsService.publish(id, user)
  }

  @Post(':id/correct')
  @Roles(Role.LAB, Role.PLATFORM)
  correct(
    @Param('id') id: string,
    @Body() dto: CorrectReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.correct(id, dto, user)
  }

  @Get(':id/views')
  views(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reportsService.views(id, user)
  }

  @Get(':id/download')
  download(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reportsService.download(id, user)
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reportsService.getOne(id, user)
  }
}
