export interface InterpretationSections {
  metricExplanation: string
  abnormalItems: string
  possibleFactors: string
  lifestyleAdvice: string
  retestAdvice: string
  disclaimer: string
}

export const INTERPRETATION_SECTION_KEYS: Array<keyof InterpretationSections> = [
  'metricExplanation',
  'abnormalItems',
  'possibleFactors',
  'lifestyleAdvice',
  'retestAdvice',
  'disclaimer',
]
