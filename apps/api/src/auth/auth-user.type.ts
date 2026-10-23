import type { Role } from '@mall/shared'

export interface AuthUser {
  sub: string
  phone: string
  roles: Role[]
  role: Role
  orgId?: string
}
