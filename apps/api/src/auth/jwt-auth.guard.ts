import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { IS_PUBLIC_KEY } from '../common/public.decorator'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const [type, token] = (request.headers.authorization ?? '').split(' ')
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('缺少登录凭证')
    }

    try {
      request.user = await this.jwtService.verifyAsync(token)
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录')
    }

    return true
  }
}
