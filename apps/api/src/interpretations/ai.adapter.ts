import type { InterpretationSections } from '@mall/shared'

export interface AiInterpretationInput {
  reportNo: string
  fields: Record<string, unknown>
  summary?: string | null
}

export interface AiInterpretationOutput {
  sections: InterpretationSections
  rawOutput: string
  promptVersion: string
  modelVersion: string
}

export interface AiAdapter {
  generate(input: AiInterpretationInput): Promise<AiInterpretationOutput>
}

export class MockAiAdapter implements AiAdapter {
  async generate(input: AiInterpretationInput): Promise<AiInterpretationOutput> {
    const metricNames = Object.keys(input.fields)
    const sections: InterpretationSections = {
      metricExplanation: `本次报告共包含 ${metricNames.length} 项指标：${metricNames.join('、') || '暂无'}。以下内容用于帮助理解指标含义。`,
      abnormalItems: input.summary ?? '本次未发现需要特别关注的异常项。',
      possibleFactors:
        '指标可能受近期饮食结构、作息、日照时间、运动习惯与采样条件影响，单次结果不能替代连续观察。',
      lifestyleAdvice:
        '建议保持均衡饮食与规律作息，适度增加户外活动；如报告提示特定指标偏低，可按营养师建议调整膳食结构。',
      retestAdvice: '建议结合自身情况在 3 至 6 个月后复查；如出现持续不适，请及时就医。',
      disclaimer: '本解读由 AI 生成，仅用于健康风险提示，不作为临床诊断依据。',
    }
    return {
      sections,
      rawOutput: JSON.stringify({ provider: 'mock', input, sections }),
      promptVersion: 'v1',
      modelVersion: 'mock-ai-v1',
    }
  }
}
