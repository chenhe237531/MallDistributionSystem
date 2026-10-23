import { Test } from '@nestjs/testing'
import { HealthController } from './health.controller'
import { PrismaService } from '../prisma/prisma.service'

describe('HealthController', () => {
  it('reports ok when the database responds', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) }
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile()

    const result = await moduleRef.get(HealthController).check()

    expect(result.status).toBe('ok')
    expect(result.database).toBe('up')
    expect(result.service).toBe('mall-distribution-api')
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
  })
})
