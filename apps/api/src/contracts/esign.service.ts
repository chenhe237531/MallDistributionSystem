import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ESignProvider, ESignTaskResult, MockESignAdapter } from './esign.adapter'

@Injectable()
export class ESignService {
  constructor(private readonly prisma: PrismaService) {}

  async getProvider(): Promise<ESignProvider> {
    const config = await this.prisma.systemConfig.findUnique({ where: { key: 'esign.provider' } })
    const provider = (config?.value as { provider?: string } | null)?.provider
    return provider === 'tencent' ? 'tencent' : 'esignbao'
  }

  async setProvider(provider: ESignProvider): Promise<{ provider: ESignProvider }> {
    await this.prisma.systemConfig.upsert({
      where: { key: 'esign.provider' },
      update: { value: { provider } },
      create: { key: 'esign.provider', value: { provider } },
    })
    return { provider }
  }

  async createTask(provider: ESignProvider, contractNo: string): Promise<ESignTaskResult> {
    const adapter = new MockESignAdapter(provider)
    return adapter.createTask(contractNo)
  }
}
