import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'

export type DatabaseProvider = 'sqlite' | 'mysql' | 'postgresql'

/** 依据 DATABASE_URL 或 DB_PROVIDER 识别当前数据库方言 */
export function detectDatabaseProvider(url = process.env.DATABASE_URL): DatabaseProvider {
  const override = process.env.DB_PROVIDER?.trim()
  if (override) {
    if (override === 'sqlite' || override === 'mysql' || override === 'postgresql') {
      return override
    }
    throw new Error(`DB_PROVIDER 仅支持 sqlite / mysql / postgresql，当前为 ${override}`)
  }
  if (!url || url.startsWith('file:')) {
    return 'sqlite'
  }
  if (url.startsWith('mysql://')) {
    return 'mysql'
  }
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgresql'
  }
  throw new Error(`无法从 DATABASE_URL 识别数据库类型：${url}`)
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  get databaseProvider(): DatabaseProvider {
    return detectDatabaseProvider()
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }

  /**
   * 事务内行锁：PostgreSQL / MySQL 使用 SELECT ... FOR UPDATE，
   * SQLite 无行锁语法，写事务本身串行化，直接跳过。
   */
  async lockRow(
    tx: Prisma.TransactionClient,
    table: 'SalesOrder' | 'Statement',
    id: string,
  ): Promise<void> {
    const provider = this.databaseProvider
    if (provider === 'sqlite') {
      return
    }
    const quotedTable = provider === 'mysql' ? `\`${table}\`` : `"${table}"`
    const placeholder = provider === 'mysql' ? '?' : '$1'
    await tx.$queryRawUnsafe(`SELECT id FROM ${quotedTable} WHERE id = ${placeholder} FOR UPDATE`, id)
  }
}
