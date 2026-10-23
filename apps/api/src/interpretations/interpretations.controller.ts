import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import {
  AnnotateInterpretationDto,
  EditInterpretationDto,
  RejectInterpretationDto,
} from './dto/interpretation.dto'
import { InterpretationsService } from './interpretations.service'

@Controller('interpretations')
export class InterpretationsController {
  constructor(private readonly interpretationsService: InterpretationsService) {}

  @Post('report/:reportId/generate')
  @Roles(Role.LAB, Role.NUTRITIONIST, Role.PLATFORM)
  generate(@Param('reportId') reportId: string) {
    return this.interpretationsService.generateForReport(reportId)
  }

  @Get('report/:reportId/latest')
  latest(@Param('reportId') reportId: string, @CurrentUser() user: AuthUser) {
    return this.interpretationsService.latest(reportId, user)
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.interpretationsService.getOne(id, user)
  }

  @Post(':id/adopt')
  @Roles(Role.NUTRITIONIST, Role.PLATFORM)
  adopt(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.interpretationsService.adopt(id, user)
  }

  @Post(':id/edit')
  @Roles(Role.NUTRITIONIST, Role.PLATFORM)
  edit(
    @Param('id') id: string,
    @Body() dto: EditInterpretationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.interpretationsService.edit(id, dto, user)
  }

  @Post(':id/annotate')
  @Roles(Role.NUTRITIONIST, Role.PLATFORM)
  annotate(
    @Param('id') id: string,
    @Body() dto: AnnotateInterpretationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.interpretationsService.annotate(id, dto, user)
  }

  @Post(':id/reject')
  @Roles(Role.NUTRITIONIST, Role.PLATFORM)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectInterpretationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.interpretationsService.reject(id, dto, user)
  }

  @Post(':id/publish')
  @Roles(Role.NUTRITIONIST, Role.PLATFORM)
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.interpretationsService.publish(id, user)
  }
}
