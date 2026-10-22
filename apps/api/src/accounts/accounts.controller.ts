import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { Role } from '@mall/shared'
import { AccountsService } from './accounts.service'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import { AddQualificationDto } from './dto/add-qualification.dto'
import { BindInviterDto } from './dto/bind-inviter.dto'
import { CreateAccountDto } from './dto/create-account.dto'
import { CreateSalesDto } from './dto/create-sales.dto'
import { ReviewQualificationDto } from './dto/review-qualification.dto'
import type { AuthUser } from '../auth/auth-user.type'

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @Roles(Role.PLATFORM)
  create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto)
  }

  @Get()
  @Roles(Role.PLATFORM)
  list(@Query('status') status?: string) {
    return this.accountsService.list(status)
  }

  @Post('sales')
  @Roles(Role.MERCHANT)
  createSales(@CurrentUser() user: AuthUser, @Body() dto: CreateSalesDto) {
    return this.accountsService.createSales(user, dto)
  }

  @Get('me/qualifications')
  myQualifications(@CurrentUser() user: AuthUser) {
    return this.accountsService.listQualifications(user.sub)
  }

  @Post('me/qualifications')
  addMyQualification(@CurrentUser() user: AuthUser, @Body() dto: AddQualificationDto) {
    return this.accountsService.addQualification(user.sub, dto)
  }

  @Post('partners/:partnerId/inviter')
  @Roles(Role.PLATFORM)
  bindInviter(@Param('partnerId') partnerId: string, @Body() dto: BindInviterDto) {
    return this.accountsService.bindInviter(partnerId, dto.inviterId)
  }

  @Get(':id/qualifications')
  @Roles(Role.PLATFORM)
  listQualifications(@Param('id') id: string) {
    return this.accountsService.listQualifications(id)
  }

  @Post(':id/qualifications')
  @Roles(Role.PLATFORM)
  addQualification(@Param('id') id: string, @Body() dto: AddQualificationDto) {
    return this.accountsService.addQualification(id, dto)
  }

  @Patch(':id/qualifications/:qualificationId/review')
  @Roles(Role.PLATFORM)
  reviewQualification(
    @Param('id') id: string,
    @Param('qualificationId') qualificationId: string,
    @Body() dto: ReviewQualificationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.accountsService.reviewQualification(id, qualificationId, dto, user.sub)
  }

  @Post(':id/approve')
  @Roles(Role.PLATFORM)
  approve(@Param('id') id: string) {
    return this.accountsService.approve(id)
  }

  @Post(':id/reject')
  @Roles(Role.PLATFORM)
  reject(@Param('id') id: string) {
    return this.accountsService.reject(id)
  }

  @Post(':id/suspend')
  @Roles(Role.PLATFORM)
  suspend(@Param('id') id: string) {
    return this.accountsService.suspend(id)
  }

  @Get(':id')
  @Roles(Role.PLATFORM)
  getOne(@Param('id') id: string) {
    return this.accountsService.getOne(id)
  }
}
