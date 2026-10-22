import type { Role } from './enums'

export interface UserSummary {
  id: string
  name: string
  phone?: string
  role: Role
  organizationId?: string
}

export interface ApiResponse<T> {
  data: T
  traceId?: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
