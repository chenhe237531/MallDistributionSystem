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

  @Get('preview/:code')
  @Roles(Role.CUSTOMER)
  preview(@Param('code') code: string) {
    return this.samplesService.previewBoxCode(code)
  }

  @Post('activate')
  @Roles(Role.CUSTOMER)
  activate(@CurrentUser() user: AuthUser, @Body() dto: ActivateBoxCodeDto) {
    return this.samplesService.activate(user, dto)
  }
}
