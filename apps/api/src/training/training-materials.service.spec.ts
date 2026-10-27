import { TrainingMaterialsService } from './training-materials.service'

/**
 * 课件资料来自「百依诺商家资料」目录的解析产物（course-materials.json）。
 * 该用例保证：课程能拿到配套课件、不同课程的归属不串、正文可读取。
 */
describe('TrainingMaterialsService', () => {
  let service: TrainingMaterialsService

  beforeEach(() => {
    service = new TrainingMaterialsService()
  })

  it('解析产物可加载', () => {
    const materials = service.summariesForCourse('sampling_ops')
    expect(materials.length).toBeGreaterThan(0)
    expect(materials.map((material) => material.id)).toContain('sampling-guide-video')
  })

  it('按课程归属返回课件，且不混入其他课程专属资料', () => {
    const sampling = service.summariesForCourse('sampling_ops').map((item) => item.id)
    const cases = service.summariesForCourse('case_teaching').map((item) => item.id)
    expect(sampling).not.toContain('fmt-cases-pptx')
    expect(cases).toContain('fmt-cases-pptx')
  })

  it('清单只带摘要与目录，不带正文，避免详情页首屏过大', () => {
    const [first] = service.summariesForCourse('product_knowledge')
    expect(first.summary.length).toBeGreaterThan(0)
    expect(first.outline.length).toBeGreaterThan(0)
    expect(first).not.toHaveProperty('sections')
  })

  it('阅读页返回小节正文与来源文件', () => {
    const reader = service.reader('fmt-faq-pdf')
    expect(reader.sourceFile).toBe('百英诺科技-菌群移植产品百问百答20260206.pdf')
    expect(reader.sections.length).toBeGreaterThan(10)
    expect(reader.sections[0].paragraphs.length).toBeGreaterThan(0)
    expect(reader.charCount).toBeGreaterThan(1000)
  })

  it('不存在的课件抛出 404', () => {
    expect(() => service.get('not-exist')).toThrow('课件不存在')
  })
})
