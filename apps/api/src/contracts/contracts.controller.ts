import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { ContractsService } from './contracts.service'
import { CreateContractDto } from './dto/create-contract.dto'
import { CreateTemplateDto } from './dto/create-template.dto'
import { InitiateContractDto } from './dto/initiate-contract.dto'
import { RegisterOfflineDto } from './dto/register-offline.dto'
import { SwitchProviderDto } from './dto/switch-provider.dto'

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post('templates')
  @Roles(Role.PLATFORM)
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.contractsService.createTemplate(dto)
  }

  @Get('templates')
  listTemplates() {
    return this.contractsService.listTemplates()
  }

  @Patch('settings/provider')
  @Roles(Role.PLATFORM)
  setProvider(@Body() dto: SwitchProviderDto) {
    return this.contractsService.setProvider(dto.provider)
  }

  @Get('settings/provider')
  getProvider() {
    return this.contractsService.getProvider()
  }

  @Get('eligibility/me')
  eligibility(@CurrentUser() user: AuthUser) {
    return this.contractsService.eligibility(user.sub)
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.contractsService.mine(user)
  }

  @Post('offline')
  @Roles(Role.PLATFORM)
  registerOffline(@Body() dto: RegisterOfflineDto, @CurrentUser() user: AuthUser) {
    return this.contractsService.registerOffline(dto, user)
  }

  @Post()
  @Roles(Role.PLATFORM)
  createContract(@Body() dto: CreateContractDto) {
    return this.contractsService.createContract(dto)
  }

  @Get()
  @Roles(Role.PLATFORM)
  list(@CurrentUser() user: AuthUser) {
    return this.contractsService.list(user)
  }

  @Post(':id/initiate')
  initiate(
    @Param('id') id: string,
    @Body() dto: InitiateContractDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractsService.initiate(id, dto, user)
  }

  @Post(':id/mock-sign')
  mockSign(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contractsService.mockSign(id, user)
  }

  @Post(':id/terminate')
  @Roles(Role.PLATFORM)
  terminate(@Param('id') id: string) {
    return this.contractsService.terminate(id)
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contractsService.getOneForActor(id, user)
  }
}
