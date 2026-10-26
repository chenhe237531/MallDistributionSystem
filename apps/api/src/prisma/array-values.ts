import type { Role } from '@mall/shared'

/**
 * 标量数组字段在 SQLite / MySQL 中存储为 Json，PostgreSQL 中为原生数组。
 * 读取时统一收敛为数组，避免上层分支处理不同方言。
 */
export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

export function asRoleArray(value: unknown): Role[] {
  return asStringArray(value) as Role[]
}
