import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import { Public } from '../common/public.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { ChannelsService } from './channels.service'
import { DisableChannelDto } from './dto/channel.dto'

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get('me')
  @Roles(Role.MERCHANT, Role.PARTNER)
  mine(@CurrentUser() user: AuthUser) {
    return this.channelsService.mine(user.sub)
  }

  @Public()
  @Get('resolve/:code')
  resolve(@Param('code') code: string) {
    return this.channelsService.resolve(code)
  }

  @Post(':id/disable')
  @Roles(Role.PLATFORM)
  disable(
    @Param('id') id: string,
    @Body() dto: DisableChannelDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.channelsService.disable(id, dto.reason, user)
  }

  @Post(':id/resume')
  @Roles(Role.PLATFORM)
  resume(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.channelsService.resume(id, user)
  }

  @Post(':id/reissue')
  @Roles(Role.PLATFORM)
  reissue(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.channelsService.reissue(id, user)
  }
}
