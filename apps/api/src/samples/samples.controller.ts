import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import {
  AbnormalityDto,
  MailSampleDto,
  ReceiveSampleDto,
  ResampleDto,
} from './dto/sample-flow.dto'
import { SamplesService } from './samples.service'

@Controller('samples')
export class SamplesController {
  constructor(private readonly samplesService: SamplesService) {}

  @Get('me')
  @Roles(Role.CUSTOMER)
  mine(@CurrentUser() user: AuthUser) {
    return this.samplesService.listMine(user.sub)
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.samplesService.list(user)
  }

  @Post(':id/mail')
  @Roles(Role.CUSTOMER)
  mail(@Param('id') id: string, @Body() dto: MailSampleDto, @CurrentUser() user: AuthUser) {
    return this.samplesService.markMailed(id, dto, user)
  }

  @Post(':id/receive')
  @Roles(Role.LAB, Role.PLATFORM)
  receive(@Param('id') id: string, @Body() dto: ReceiveSampleDto, @CurrentUser() user: AuthUser) {
    return this.samplesService.receive(id, dto, user)
  }

  @Post(':id/testing')
  @Roles(Role.LAB, Role.PLATFORM)
  testing(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.samplesService.startTesting(id, user)
  }

  @Post(':id/abnormal')
  @Roles(Role.LAB, Role.PLATFORM)
  abnormal(@Param('id') id: string, @Body() dto: AbnormalityDto, @CurrentUser() user: AuthUser) {
    return this.samplesService.markAbnormal(id, dto, user)
  }

  @Post(':id/resample')
  @Roles(Role.LAB, Role.PLATFORM)
  resample(@Param('id') id: string, @Body() dto: ResampleDto, @CurrentUser() user: AuthUser) {
    return this.samplesService.resample(id, dto, user)
  }

  @Post(':id/void')
  @Roles(Role.LAB, Role.PLATFORM)
  voidSample(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.samplesService.voidSample(id, user)
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.samplesService.getOne(id, user)
  }
}
