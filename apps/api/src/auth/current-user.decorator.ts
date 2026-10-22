import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthUser } from './auth-user.type'

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    return context.switchToHttp().getRequest().user as AuthUser
  },
)
