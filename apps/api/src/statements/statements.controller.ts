import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import {
  GenerateStatementDto,
  RegisterVoucherDto,
  ResolveDifferenceDto,
  StatementAdjustmentDto,
  StatementDifferenceDto,
} from './dto/statement.dto'
import { StatementsService } from './statements.service'

@Controller('statements')
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Post('generate')
  @Roles(Role.PLATFORM)
  generate(@Body() dto: GenerateStatementDto, @CurrentUser() user: AuthUser) {
    return this.statementsService.generate(dto, user)
  }

  @Get('overview')
  @Roles(Role.PLATFORM)
  overview() {
    return this.statementsService.overview()
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('period') period?: string) {
    return this.statementsService.list(user, period)
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.statementsService.getOne(id, user)
  }

  @Post(':id/vouchers')
  @Roles(Role.PLATFORM)
  registerVoucher(
    @Param('id') id: string,
    @Body() dto: RegisterVoucherDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.statementsService.registerVoucher(id, dto, user)
  }

  @Post(':id/adjustments')
  @Roles(Role.PLATFORM)
  addAdjustment(
    @Param('id') id: string,
    @Body() dto: StatementAdjustmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.statementsService.addAdjustment(id, dto, user)
  }

  @Post(':id/differences')
  @Roles(Role.PLATFORM)
  addDifference(
    @Param('id') id: string,
    @Body() dto: StatementDifferenceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.statementsService.addDifference(id, dto, user)
  }

  @Post(':id/differences/:differenceId/resolve')
  @Roles(Role.PLATFORM)
  resolveDifference(
    @Param('id') id: string,
    @Param('differenceId') differenceId: string,
    @Body() dto: ResolveDifferenceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.statementsService.resolveDifference(id, differenceId, dto, user)
  }

  @Post(':id/reconcile')
  @Roles(Role.PLATFORM)
  reconcile(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.statementsService.reconcile(id, user)
  }

  @Post(':id/settle')
  @Roles(Role.PLATFORM)
  settle(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.statementsService.settle(id, user)
  }

  @Post(':id/reopen')
  @Roles(Role.PLATFORM)
  reopen(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.statementsService.reopen(id, user)
  }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query('format') format: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const isPdf = format === 'pdf'
    const buffer = isPdf
      ? await this.statementsService.exportPdf(id, user)
      : await this.statementsService.exportExcel(id, user)
    response.setHeader(
      'Content-Type',
      isPdf
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="statement-${id}.${isPdf ? 'pdf' : 'xlsx'}"`,
    )
    response.send(buffer)
  }
}
