import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { ActivateBoxCodeDto } from './dto/activation.dto'
import { SamplesService } from './samples.service'

@Controller('box-codes')
export class BoxActivationController {
  constructor(private readonly samplesService: SamplesService) {}

  @Post('activate')
  @Roles(Role.CUSTOMER)
  activate(@CurrentUser() user: AuthUser, @Body() dto: ActivateBoxCodeDto) {
    return this.samplesService.activate(user, dto)
  }
}
