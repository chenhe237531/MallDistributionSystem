import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { CreateProcurementDto } from './dto/create-procurement.dto'
import { SwitchMultiSupplierDto } from './dto/switch-multi-supplier.dto'
import { ProcurementService } from './procurement.service'

@Controller('procurement-orders')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('settings/multi-supplier')
  getMultiSupplier() {
    return this.procurementService.getMultiSupplierEnabled()
  }

  @Patch('settings/multi-supplier')
  @Roles(Role.PLATFORM)
  setMultiSupplier(@Body() dto: SwitchMultiSupplierDto) {
    return this.procurementService.setMultiSupplierEnabled(dto.enabled)
  }

  @Post()
  @Roles(Role.MERCHANT)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProcurementDto) {
    return this.procurementService.create(user, dto)
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.procurementService.list(user)
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.procurementService.getOne(id, user)
  }

  @Post(':id/confirm')
  @Roles(Role.SUPPLIER, Role.PLATFORM)
  confirm(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.procurementService.confirm(id, user)
  }

  @Post(':id/ship')
  @Roles(Role.SUPPLIER, Role.PLATFORM)
  ship(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.procurementService.ship(id, user)
  }

  @Post(':id/receive')
  @Roles(Role.MERCHANT)
  receive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.procurementService.receive(id, user)
  }

  @Post(':id/complete')
  @Roles(Role.PLATFORM)
  complete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.procurementService.complete(id, user)
  }

  @Post(':id/cancel')
  @Roles(Role.MERCHANT)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.procurementService.cancel(id, user)
  }

  @Post(':id/refund')
  @Roles(Role.PLATFORM)
  refund(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.procurementService.refund(id, user)
  }
}
