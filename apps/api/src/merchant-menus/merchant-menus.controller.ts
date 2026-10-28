import { Body, Controller, Get, Param, Put } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { MerchantMenusService } from './merchant-menus.service'
import { SaveMerchantMenusDto } from './dto/save-merchant-menus.dto'

@Controller('merchant-menus')
export class MerchantMenusController {
  constructor(private readonly merchantMenusService: MerchantMenusService) {}

  /** 商家端登录用户获取自己的生效菜单（商家主账号 / 销售） */
  @Get('me')
  @Roles(Role.MERCHANT, Role.SALES)
  me(@CurrentUser() user: AuthUser) {
    return this.merchantMenusService.resolveForUser(user)
  }

  /** 后台查询某商家的菜单权限 */
  @Get(':merchantId')
  @Roles(Role.PLATFORM)
  getForMerchant(@Param('merchantId') merchantId: string) {
    return this.merchantMenusService.getForMerchant(merchantId)
  }

  /** 后台保存某商家的菜单权限 */
  @Put(':merchantId')
  @Roles(Role.PLATFORM)
  save(
    @Param('merchantId') merchantId: string,
    @Body() dto: SaveMerchantMenusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.merchantMenusService.save(merchantId, dto.menus, user)
  }
}
