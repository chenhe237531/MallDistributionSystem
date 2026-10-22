import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

type CourseSummary = {
  id: string
  code: string
  questions: Array<{ id: string; answer?: string | string[] }>
}
type LearningRecord = {
  id: string
  status: string
  progress: number
  attemptCount: number
  examScore: number | null
  expiresAt: string | null
  course: { id: string; code: string; chapters: Array<{ id: string }> }
}

describe('Training, exams and learning records (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let merchantToken: string
  let partnerToken: string
  let partnerId: string
  let merchantId: string
  let salesId: string
  let complianceRecord: LearningRecord

  const login = async (phone: string, password: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone, password })
      .expect(201)
    return response.body.token as string
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()

    platformToken = await login('13800000000', 'Admin@123')

    const merchant = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        phone: `230${suffix}`,
        password: 'Passw0rd',
        name: '培训测试商家',
        primaryRole: 'merchant',
        organizationName: `培训商家组织${suffix}`,
      })
      .expect(201)
    merchantId = merchant.body.id
    await request(app.getHttpServer())
      .post(`/api/accounts/${merchantId}/approve`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)
    merchantToken = await login(`230${suffix}`, 'Passw0rd')

    const sales = await request(app.getHttpServer())
      .post('/api/accounts/sales')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ phone: `231${suffix}`, password: 'Passw0rd', name: '培训测试销售' })
      .expect(201)
    salesId = sales.body.id

    const partner = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        phone: `232${suffix}`,
        password: 'Passw0rd',
        name: '培训测试合伙人',
        primaryRole: 'partner',
      })
      .expect(201)
    partnerId = partner.body.id
    await request(app.getHttpServer())
      .post(`/api/accounts/${partnerId}/approve`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)
    partnerToken = await login(`232${suffix}`, 'Passw0rd')
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('auto-assigns courses by role and hides answers from learners', async () => {
    const records = await request(app.getHttpServer())
      .get('/api/training/me')
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(200)
    const codes = records.body.map((record: LearningRecord) => record.course.code)
    expect(codes).toContain('newbie_course')
    expect(codes).toContain('compliance_course')

    complianceRecord = records.body.find(
      (record: LearningRecord) => record.course.code === 'compliance_course',
    )

    const course = await request(app.getHttpServer())
      .get(`/api/training/courses/${complianceRecord.course.id}`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(200)
    expect(course.body.questions[0].answer).toBeUndefined()

    const platformCourse = await request(app.getHttpServer())
      .get(`/api/training/courses/${complianceRecord.course.id}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(platformCourse.body.questions[0].answer).toBeDefined()
  })

  it('requires all chapters before the exam', async () => {
    await request(app.getHttpServer())
      .post(`/api/training/records/${complianceRecord.id}/exam`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ answers: {} })
      .expect(400)

    for (const chapter of complianceRecord.course.chapters) {
      await request(app.getHttpServer())
        .post(`/api/training/records/${complianceRecord.id}/chapters/${chapter.id}/complete`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({})
        .expect(201)
    }

    const records = await request(app.getHttpServer())
      .get('/api/training/me')
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(200)
    const record = records.body.find((item: LearningRecord) => item.id === complianceRecord.id)
    expect(record.status).toBe('pending_exam')
    expect(record.progress).toBe(100)
  })

  it('scores attempts, voids anomalous exams and enforces the retake limit', async () => {
    const failed = await request(app.getHttpServer())
      .post(`/api/training/records/${complianceRecord.id}/exam`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ answers: {} })
      .expect(201)
    expect(failed.body.status).toBe('pending_exam')
    expect(failed.body.examScore).toBeLessThan(60)
    expect(failed.body.attemptCount).toBe(1)

    const anomaly = await request(app.getHttpServer())
      .post(`/api/training/records/${complianceRecord.id}/exam`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ answers: {}, screenSwitches: 4 })
      .expect(201)
    expect(anomaly.body.anomaly).toBe(true)
    expect(anomaly.body.score).toBe(0)

    const course = await request(app.getHttpServer())
      .get(`/api/training/courses/${complianceRecord.course.id}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    const answers: Record<string, string | string[]> = {}
    for (const question of course.body.questions as Array<{
      id: string
      answer: string | string[]
    }>) {
      answers[question.id] = question.answer
    }

    const passed = await request(app.getHttpServer())
      .post(`/api/training/records/${complianceRecord.id}/exam`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ answers })
      .expect(201)
    expect(passed.body.status).toBe('passed')
    expect(passed.body.examScore).toBe(100)
    expect(passed.body.attemptCount).toBe(2)
    expect(passed.body.expiresAt).toBeTruthy()

    await request(app.getHttpServer())
      .post(`/api/training/records/${complianceRecord.id}/exam`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ answers })
      .expect(400)
  })

  it('creates expiry reminders for compliance courses', async () => {
    await prisma.learningRecord.update({
      where: { id: complianceRecord.id },
      data: { expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) },
    })
    await request(app.getHttpServer())
      .post('/api/reminders/scan')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)

    const reminders = await request(app.getHttpServer())
      .get('/api/reminders')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(
      reminders.body.some(
        (item: { type: string; subjectId: string }) =>
          item.type === 'training_expiry' && item.subjectId === partnerId,
      ),
    ).toBe(true)
  })

  it('shows the merchant their sales team progress but blocks course editing', async () => {
    const team = await request(app.getHttpServer())
      .get('/api/training/merchant/sales')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(team.body.records.length).toBeGreaterThanOrEqual(1)
    expect(team.body.records[0].user.id).toBe(salesId)
    expect(typeof team.body.completionRate).toBe('number')

    await request(app.getHttpServer())
      .post('/api/training/courses')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        code: `merchant-course-${suffix}`,
        name: '商家自建课程',
        category: 'custom',
        audience: ['sales'],
      })
      .expect(403)

    const created = await request(app.getHttpServer())
      .post('/api/training/courses')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        code: `platform-course-${suffix}`,
        name: '平台新建课程',
        category: 'custom',
        audience: ['partner'],
        validityMonths: 6,
      })
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/training/courses/${created.body.id}/chapters`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ title: '第一章', content: '内容' })
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/training/courses/${created.body.id}/questions`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        type: 'single',
        prompt: '测试题',
        options: [
          { key: 'A', text: '选项 A' },
          { key: 'B', text: '选项 B' },
        ],
        answer: 'A',
      })
      .expect(201)
  })
})
