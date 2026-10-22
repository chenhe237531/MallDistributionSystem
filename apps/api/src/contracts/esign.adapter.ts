export type ESignProvider = 'esignbao' | 'tencent'

export interface ESignTaskResult {
  externalId: string
  signUrl: string
}

export interface ESignAdapter {
  readonly provider: ESignProvider
  createTask(contractNo: string): Promise<ESignTaskResult>
}

/**
 * 本地开发与测试使用的电子签适配器。
 * 生产环境可按同一接口接入 e签宝或腾讯电子签，切换只影响新发起的签署任务。
 */
export class MockESignAdapter implements ESignAdapter {
  constructor(readonly provider: ESignProvider) {}

  async createTask(contractNo: string): Promise<ESignTaskResult> {
    const suffix = Math.random().toString(36).slice(2, 10).toUpperCase()
    return {
      externalId: `MOCK-${this.provider.toUpperCase()}-${suffix}`,
      signUrl: `https://mock-esign.local/${this.provider}/sign/${contractNo}`,
    }
  }
}
