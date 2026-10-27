import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { CustomersService } from './customers.service'
import { BindInviteCodeDto } from './dto/invite-code.dto'
import { RealNameDto } from './dto/real-name.dto'
import {
  CreateShippingAddressDto,
  UpdateShippingAddressDto,
} from './dto/address.dto'
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

  /** 绑定商家邀请码：支持登录后手动输入或扫描商家二维码 */
  @Post('me/invite-code')
  bindInviteCode(@CurrentUser() user: AuthUser, @Body() dto: BindInviteCodeDto) {
    return this.customersService.bindInviteCode(user.sub, dto)
  }

  @Patch('me/report-authorization')
  setReportAuthorization(@CurrentUser() user: AuthUser, @Body() dto: ReportAuthorizationDto) {
    return this.customersService.setReportAuthorization(user.sub, dto)
  }

  /** C 端收货地址（检测盒寄送）：下单自动带入默认地址，也可在地址簿中维护 */
  @Get('me/addresses')
  listAddresses(@CurrentUser() user: AuthUser) {
    return this.customersService.listAddresses(user.sub)
  }

  @Post('me/addresses')
  createAddress(@CurrentUser() user: AuthUser, @Body() dto: CreateShippingAddressDto) {
    return this.customersService.createAddress(user.sub, dto)
  }

  @Patch('me/addresses/:id')
  updateAddress(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateShippingAddressDto,
  ) {
    return this.customersService.updateAddress(user.sub, id, dto)
  }

  @Delete('me/addresses/:id')
  deleteAddress(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customersService.deleteAddress(user.sub, id)
  }
}
