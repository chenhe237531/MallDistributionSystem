import { Controller, Get, Post } from '@nestjs/common'
import { Role } from '@mall/shared'
import { CurrentUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.decorator'
import type { AuthUser } from '../auth/auth-user.type'
import { RemindersService } from './reminders.service'

@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.remindersService.listMine(user.sub)
  }

  @Get()
  @Roles(Role.PLATFORM)
  all() {
    return this.remindersService.listAll()
  }

  @Post('scan')
  @Roles(Role.PLATFORM)
  scan() {
    return this.remindersService.scanQualificationExpiry()
  }
}
