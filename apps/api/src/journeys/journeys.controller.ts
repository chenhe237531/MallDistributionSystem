import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import {
  CancelJourneyDto,
  PauseJourneyDto,
  QueryJourneysDto,
  ResumeJourneyDto,
  ScheduleJourneyDto,
  SelfConfirmBowelPrepDto,
} from './dto/journey.dto'
import { JourneyDispatchService } from './journey-dispatch.service'
import { JourneysService } from './journeys.service'

@Controller('journeys')
export class JourneysController {
  constructor(
    private readonly journeysService: JourneysService,
    private readonly dispatchService: JourneyDispatchService,
  ) {}

  /** C 端：我的旅程（含今日三条任务与清肠状态） */
  @Get('mine')
  @Roles(Role.CUSTOMER)
  mine(@CurrentUser() user: AuthUser) {
    return this.journeysService.listMine(user)
  }

  /** 商家：名下客户旅程；平台：全部旅程 */
  @Get()
  @Roles(Role.MERCHANT, Role.PLATFORM)
  list(@CurrentUser() user: AuthUser, @Query() query: QueryJourneysDto) {
    return this.journeysService.list(user, query)
  }

  @Get('overview')
  @Roles(Role.MERCHANT, Role.PLATFORM)
  overview(@CurrentUser() user: AuthUser) {
    return this.journeysService.overview(user)
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.journeysService.getOne(id, user)
  }

  @Get(':id/timeline')
  timeline(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.journeysService.timeline(
      id,
      user,
      from === undefined ? undefined : Number(from),
      to === undefined ? undefined : Number(to),
    )
  }

  @Post(':id/schedule')
  @Roles(Role.CUSTOMER, Role.MERCHANT, Role.PLATFORM)
  schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleJourneyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.journeysService.schedule(id, dto, user)
  }

  @Post(':id/pause')
  @Roles(Role.CUSTOMER, Role.MERCHANT, Role.PLATFORM)
  pause(
    @Param('id') id: string,
    @Body() dto: PauseJourneyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.journeysService.pause(id, dto, user)
  }

  @Post(':id/resume')
  @Roles(Role.CUSTOMER, Role.MERCHANT, Role.PLATFORM)
  resume(
    @Param('id') id: string,
    @Body() dto: ResumeJourneyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.journeysService.resume(id, dto, user)
  }

  @Post(':id/cancel')
  @Roles(Role.PLATFORM)
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelJourneyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.journeysService.cancel(id, dto, user)
  }

  /** 路径 A：平台购买清肠药（服务端取价，复用销售订单与支付链路） */
  @Post(':id/bowel-prep/platform-order')
  @Roles(Role.CUSTOMER)
  platformOrder(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.journeysService.placeBowelPrepOrder(id, user)
  }

  /** 路径 B：自购确认 */
  @Post(':id/bowel-prep/self-confirm')
  @Roles(Role.CUSTOMER)
  selfConfirm(
    @Param('id') id: string,
    @Body() dto: SelfConfirmBowelPrepDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.journeysService.confirmSelfPurchase(id, dto, user)
  }

  @Post(':id/bowel-prep/ready')
  @Roles(Role.CUSTOMER, Role.MERCHANT, Role.PLATFORM)
  ready(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.journeysService.markBowelPrepReady(id, user)
  }

  @Post(':id/bowel-prep/reset')
  @Roles(Role.CUSTOMER, Role.PLATFORM)
  reset(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.journeysService.resetBowelPrep(id, user)
  }

  @Post(':id/push-tasks/:taskId/resend')
  @Roles(Role.PLATFORM)
  resend(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.journeysService.resendTask(id, taskId, user)
  }

  /** 平台手动触发调度（联调与验收用） */
  @Post('dispatch-now')
  @Roles(Role.PLATFORM)
  dispatchNow() {
    return this.dispatchService.dispatchDue()
  }

  @Post('bowel-prep-check')
  @Roles(Role.PLATFORM)
  bowelPrepCheck() {
    return this.dispatchService.checkBowelPrep()
  }

  @Post('rollover-now')
  @Roles(Role.PLATFORM)
  rolloverNow() {
    return this.dispatchService.rollover()
  }
}
