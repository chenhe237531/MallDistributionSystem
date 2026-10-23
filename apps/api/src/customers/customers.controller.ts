import { Body, Controller, Get, Patch } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { CustomersService } from './customers.service'
import { RealNameDto } from './dto/real-name.dto'
import { ReportAuthorizationDto } from '../samples/dto/activation.dto'

@Controller('customers')
@Roles(Role.CUSTOMER)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.customersService.getMe(user.sub)
  }

  @Patch('me/real-name')
  setRealName(@CurrentUser() user: AuthUser, @Body() dto: RealNameDto) {
    return this.customersService.setRealName(user.sub, dto)
  }

  @Get('me/ownership')
  ownership(@CurrentUser() user: AuthUser) {
    return this.customersService.getOwnership(user.sub)
  }

  @Patch('me/report-authorization')
  setReportAuthorization(@CurrentUser() user: AuthUser, @Body() dto: ReportAuthorizationDto) {
    return this.customersService.setReportAuthorization(user.sub, dto)
  }
}
