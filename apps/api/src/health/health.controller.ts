import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { Role } from '@mall/shared'
import { Public } from '../common/public.decorator'
import { PrismaService } from '../prisma/prisma.service'

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{
    status: string
    database: string
    service: string
    version: string
    roles: Role[]
    timestamp: string
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        service: 'mall-distribution-api',
      })
    }

    return {
      status: 'ok',
      database: 'up',
      service: 'mall-distribution-api',
      version: '0.1.0',
      roles: Object.values(Role),
      timestamp: new Date().toISOString(),
    }
  }
}
