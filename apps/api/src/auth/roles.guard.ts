import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Role } from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import type { AuthUser } from './auth-user.type'
import { ROLES_KEY } from './roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) {
      return true
    }

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined
    if (!user) {
      throw new ForbiddenException('无访问权限')
    }
    if (user.roles.includes(Role.PLATFORM)) {
      return true
    }
    if (!required.some((role) => user.roles.includes(role))) {
      const request = context.switchToHttp().getRequest()
      try {
        await this.auditService.record({
          actor: user,
          action: 'permission.denied',
          resourceType: 'api',
          resourceId: request.route?.path ?? request.url,
          detail: {
            method: request.method,
            path: request.originalUrl ?? request.url,
            requiredRoles: required,
          },
        })
      } catch {
        // 留痕失败不能掩盖越权拒绝结果
      }
      throw new ForbiddenException('当前角色无权执行该操作')
    }
    return true
  }
}
