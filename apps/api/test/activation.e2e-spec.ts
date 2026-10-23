import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

type Template = { id: string; code: string; version: number }

describe('Box activation and ownership (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let supplierToken: string
  let merchantToken: string
  let customerToken: string
  let customer2Token: string
  let customer3Token: string
  let customer1Id: string
  let customer2Id: string
  let salesToken: string
  let salesId: string
  let supplierId: string
  let merchantId: string
  let productId: string
  let orderId: string
  let boxCode: string
  let secondBoxCode: string
  let sampleId: string
  let secondSampleId: string
  let channelId: string
  let reportId: string
  let correctedReportId: string
  let interpretationId: string

  const login = async (phone: string, password: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone, password })
      .expect(201)
    return response.body.token as string
  }

  const createAccount = async (
    role: 'merchant' | 'supplier',
    phone: string,
    name: string,
  ): Promise<string> => {
    const created = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        phone,
        password: 'Passw0rd',
        name,
        primaryRole: role,
        organizationName: `${name}组织${suffix}`,
      })
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/accounts/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)
    return created.body.id as string
  }

  const activateContract = async (templateId: string, subjectId: string, subjectToken: string) => {
    const created = await request(app.getHttpServer())
      .post('/api/contracts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ templateId, subjectUserId: subjectId })
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/contracts/${created.body.id}/initiate`)
      .set('Authorization', `Bearer ${subjectToken}`)
      .send({})
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/contracts/${created.body.id}/mock-sign`)
      .set('Authorization', `Bearer ${subjectToken}`)
      .expect(201)
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()

    platformToken = await login('13800000000', 'Admin@123')

    supplierId = await createAccount('supplier', `210${suffix}`, '激活测试供应商')
    merchantId = await createAccount('merchant', `211${suffix}`, '激活测试商家')
    supplierToken = await login(`210${suffix}`, 'Passw0rd')
    merchantToken = await login(`211${suffix}`, 'Passw0rd')

    const customer1 = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: `212${suffix}`, password: 'Passw0rd', name: '激活测试客户' })
      .expect(201)
    customerToken = customer1.body.token
    customer1Id = customer1.body.user.id
    await request(app.getHttpServer())
      .patch('/api/customers/me/real-name')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ realName: '李四', idCardNo: '110101199003071234', gender: 'male' })
      .expect(200)

    const customer2 = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: `213${suffix}`, password: 'Passw0rd', name: '未实名客户' })
      .expect(201)
    customer2Token = customer2.body.token
    customer2Id = customer2.body.user.id
    await request(app.getHttpServer())
      .patch('/api/customers/me/real-name')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({ realName: '王五', idCardNo: '110101199003071234', gender: 'female' })
      .expect(200)

    const customer3 = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: `214${suffix}`, password: 'Passw0rd', name: '未实名客户二' })
      .expect(201)
    customer3Token = customer3.body.token

    const sales = await request(app.getHttpServer())
      .post('/api/accounts/sales')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ phone: `215${suffix}`, password: 'Passw0rd', name: '激活测试销售' })
      .expect(201)
    salesId = sales.body.id
    salesToken = await login(`215${suffix}`, 'Passw0rd')

    const templatesResponse = await request(app.getHttpServer())
      .get('/api/contracts/templates')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    const templates = templatesResponse.body as Template[]
    await activateContract(
      templates.find((item) => item.code === 'supplier_supply' && item.version === 1)!.id,
      supplierId,
      supplierToken,
    )
    await activateContract(
      templates.find((item) => item.code === 'merchant_onboarding' && item.version === 1)!.id,
      merchantId,
      merchantToken,
    )

    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        skuCode: `ACT-${suffix}`,
        name: '激活测试检测盒',
        testItems: ['维生素D'],
        sampleType: '指尖血',
        samplingMethod: '自行采样',
        storageCondition: '常温',
        shelfLifeDays: 365,
        questionnaireFields: [
          { key: 'gender', label: '性别', required: true },
          { key: 'age', label: '年龄', required: true },
        ],
        supplyPriceCents: 8000,
        distributable: true,
      })
      .expect(201)
    productId = product.body.id
    await request(app.getHttpServer())
      .post(`/api/products/${productId}/review`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        retailPriceCents: 19900,
        platformServiceRateBps: 1000,
        commissionRateCapBps: 2000,
        distributable: true,
        status: 'active',
      })
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/products/${productId}/batches`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        batchNo: `AB-${suffix}`,
        productionDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 5,
      })
      .expect(201)

    await prisma.prepaidAccount.upsert({
      where: { merchantId },
      update: { availableCents: 200000, totalRechargeCents: 200000, frozenCents: 0, totalDeductedCents: 0 },
      create: { merchantId, availableCents: 200000, totalRechargeCents: 200000 },
    })
    const procurement = await request(app.getHttpServer())
      .post('/api/procurement-orders')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ items: [{ productId, quantity: 2 }] })
      .expect(201)
    const codes = await request(app.getHttpServer())
      .post('/api/box-codes/generate')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ procurementOrderId: procurement.body.id })
      .expect(201)
    boxCode = codes.body[0].code
    secondBoxCode = codes.body[1].code

    const channels = await request(app.getHttpServer())
      .get('/api/channels/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    channelId = channels.body[0].id

    const listing = await request(app.getHttpServer())
      .post('/api/products/merchant/listings')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ productId, retailPriceCents: 21900 })
      .expect(201)
    const order = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ listingId: listing.body.id, quantity: 1 }],
        contactName: '李四',
        contactPhone: `212${suffix}`,
        channelCode: channels.body[0].code,
      })
      .expect(201)
    orderId = order.body.id
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('requires real-name before activation', async () => {
    await request(app.getHttpServer())
      .post('/api/box-codes/activate')
      .set('Authorization', `Bearer ${customer3Token}`)
      .send({
        boxCode,
        questionnaire: { gender: 'male', age: 30 },
        consentGiven: true,
        reportAuthorization: true,
        samplingMethod: 'self_mail',
      })
      .expect(400)
  })

  it('requires consent and the configured questionnaire fields', async () => {
    await request(app.getHttpServer())
      .post('/api/box-codes/activate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        boxCode,
        questionnaire: { gender: 'male', age: 30 },
        consentGiven: false,
        reportAuthorization: true,
        samplingMethod: 'self_mail',
      })
      .expect(400)

    await request(app.getHttpServer())
      .post('/api/box-codes/activate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        boxCode,
        questionnaire: { gender: 'male' },
        consentGiven: true,
        reportAuthorization: true,
        samplingMethod: 'self_mail',
      })
      .expect(400)
  })

  it('activates the box, writes ownership and creates a sample', async () => {
    const activated = await request(app.getHttpServer())
      .post('/api/box-codes/activate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        boxCode,
        orderId,
        questionnaire: { gender: 'male', age: 30 },
        consentGiven: true,
        reportAuthorization: true,
        samplingMethod: 'self_mail',
        ip: '127.0.0.1',
        device: 'e2e',
      })
      .expect(201)
    sampleId = activated.body.sample.id

    expect(activated.body.sample.status).toBe('activated')
    expect(activated.body.sample.sampleNo).toMatch(/^SP/)
    expect(activated.body.ownership.channelId).toBe(channelId)
    expect(activated.body.ownership.channelType).toBe('merchant')
    expect(activated.body.consent.reportAuthorization).toBe(true)
    expect(activated.body.consent.templateCode).toBe('customer_detection')

    const ownership = await request(app.getHttpServer())
      .get('/api/customers/me/ownership')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(ownership.body.ownership.sourceBoxCode).toBe(boxCode)
    expect(ownership.body.samples).toHaveLength(1)

    const order = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(order.body.attributedChannelId).toBe(channelId)

    const resolved = await request(app.getHttpServer())
      .get(`/api/box-codes/resolve/${boxCode}`)
      .expect(200)
    expect(resolved.body.status).toBe('active')
  })

  it('rejects a second customer scanning the same box code', async () => {
    await request(app.getHttpServer())
      .post('/api/box-codes/activate')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        boxCode,
        questionnaire: { gender: 'female', age: 28 },
        consentGiven: true,
        reportAuthorization: true,
        samplingMethod: 'self_mail',
      })
      .expect(409)
  })

  it('lets the customer close and reopen report authorization', async () => {
    const closed = await request(app.getHttpServer())
      .patch('/api/customers/me/report-authorization')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ authorized: false })
      .expect(200)
    expect(closed.body.reportAuthorization).toBe(false)

    const ownership = await request(app.getHttpServer())
      .get('/api/customers/me/ownership')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(ownership.body.consent.reportAuthorization).toBe(false)
  })

  it('lets the lab list samples and fetch sample detail', async () => {
    const samples = await request(app.getHttpServer())
      .get('/api/samples')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(samples.body.some((sample: { id: string }) => sample.id === sampleId)).toBe(true)

    const detail = await request(app.getHttpServer())
      .get(`/api/samples/${sampleId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(detail.body.boxCode.code).toBe(boxCode)
    expect(detail.body.events[0].type).toBe('activated')
  })

  it('moves a sample through mailing, lab receipt and testing', async () => {
    const activated = await request(app.getHttpServer())
      .post('/api/box-codes/activate')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        boxCode: secondBoxCode,
        questionnaire: { gender: 'female', age: 28 },
        consentGiven: true,
        reportAuthorization: true,
        samplingMethod: 'self_mail',
      })
      .expect(201)
    secondSampleId = activated.body.sample.id

    const mailed = await request(app.getHttpServer())
      .post(`/api/samples/${secondSampleId}/mail`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({ trackingNo: 'SF123456789' })
      .expect(201)
    expect(mailed.body.status).toBe('in_transit')

    const received = await request(app.getHttpServer())
      .post(`/api/samples/${secondSampleId}/receive`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        boxCodeMatched: true,
        samplingTimeValid: true,
        storageConditionOk: true,
        transitWithinLimit: true,
      })
      .expect(201)
    expect(received.body.status).toBe('received_by_lab')
    expect(received.body.receivedAt).toBeTruthy()

    const testing = await request(app.getHttpServer())
      .post(`/api/samples/${secondSampleId}/testing`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(testing.body.status).toBe('testing')
  })

  it('marks an abnormal receipt and allows at most two resamples', async () => {
    const abnormal = await request(app.getHttpServer())
      .post(`/api/samples/${sampleId}/receive`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        boxCodeMatched: false,
        samplingTimeValid: true,
        storageConditionOk: true,
        transitWithinLimit: true,
        note: '盒码与样本不符',
      })
      .expect(201)
    expect(abnormal.body.status).toBe('abnormal')
    expect(abnormal.body.abnormalReason).toContain('盒码不符')

    const first = await request(app.getHttpServer())
      .post(`/api/samples/${sampleId}/resample`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: '样本不合格补采' })
      .expect(201)
    expect(first.body.boxCode.code).toMatch(/^BX/)
    expect(first.body.boxCode.status).toBe('generated')
    expect(first.body.sample.resampleCount).toBe(1)

    await request(app.getHttpServer())
      .post(`/api/samples/${sampleId}/resample`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: '第二次补采' })
      .expect(201)

    await request(app.getHttpServer())
      .post(`/api/samples/${sampleId}/resample`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: '第三次补采' })
      .expect(400)

    const detail = await request(app.getHttpServer())
      .get(`/api/samples/${sampleId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(detail.body.resampleCount).toBe(2)
    expect(detail.body.events.some((event: { type: string }) => event.type === 'resample')).toBe(
      true,
    )
  })

  it('publishes a report and exposes it to the owning customer and channel', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/reports')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        sampleId: secondSampleId,
        fields: {
          vitaminD: { value: 25, unit: 'ng/mL', reference: '30-100' },
          ferritin: { value: 60, unit: 'ng/mL', reference: '15-150' },
        },
        summary: '维生素 D 偏低，建议增加日照与复查。',
        missingItems: ['铁蛋白复测'],
        pdfUrl: 'local://reports/e2e-report-v1.pdf',
      })
      .expect(201)
    reportId = created.body.id
    expect(created.body.status).toBe('draft')
    expect(created.body.missingItems).toEqual(['铁蛋白复测'])

    await request(app.getHttpServer())
      .post(`/api/reports/${reportId}/submit`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)

    const published = await request(app.getHttpServer())
      .post(`/api/reports/${reportId}/publish`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(published.body.status).toBe('published')
    expect(published.body.publishedAt).toBeTruthy()

    const sample = await request(app.getHttpServer())
      .get(`/api/samples/${secondSampleId}`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .expect(200)
    expect(sample.body.status).toBe('published')

    const customerView = await request(app.getHttpServer())
      .get(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .expect(200)
    expect(customerView.body.contentHidden).toBe(false)
    expect(customerView.body.fields.vitaminD.value).toBe(25)
    expect(customerView.body.disclaimer).toContain('不作为临床诊断依据')

    const merchantView = await request(app.getHttpServer())
      .get(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(merchantView.body.contentHidden).toBe(false)
    expect(merchantView.body.watermark).toContain('merchant')
  })

  it('records report views and lets the customer inspect them', async () => {
    const views = await request(app.getHttpServer())
      .get(`/api/reports/${reportId}/views`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .expect(200)
    expect(views.body.length).toBeGreaterThanOrEqual(2)
    expect(views.body.some((view: { role: string }) => view.role === 'merchant')).toBe(true)

    const myViews = await request(app.getHttpServer())
      .get('/api/reports/me/views')
      .set('Authorization', `Bearer ${customer2Token}`)
      .expect(200)
    expect(myViews.body.some((view: { reportId: string }) => view.reportId === reportId)).toBe(true)

    const download = await request(app.getHttpServer())
      .get(`/api/reports/${reportId}/download`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .expect(200)
    expect(download.body.url).toBe('local://reports/e2e-report-v1.pdf')
    expect(download.body.version).toBe(1)
  })

  it('redacts content for the channel after the customer revokes authorization', async () => {
    await request(app.getHttpServer())
      .patch('/api/customers/me/report-authorization')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({ authorized: false })
      .expect(200)

    const merchantView = await request(app.getHttpServer())
      .get(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(merchantView.body.contentHidden).toBe(true)
    expect(merchantView.body.fields).toBeUndefined()

    const customerView = await request(app.getHttpServer())
      .get(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .expect(200)
    expect(customerView.body.contentHidden).toBe(false)
  })

  it('denies cross-ownership access and records the attempt', async () => {
    await request(app.getHttpServer())
      .get(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403)

    const alerts = await prisma.systemAlert.findMany({
      where: { type: 'report_access_denied', subjectId: reportId },
    })
    expect(alerts).toHaveLength(1)
  })

  it('creates a corrected version and archives the previous report', async () => {
    const corrected = await request(app.getHttpServer())
      .post(`/api/reports/${reportId}/correct`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        fields: {
          vitaminD: { value: 31, unit: 'ng/mL', reference: '30-100' },
        },
        summary: '复测后维生素 D 已达标。',
        pdfUrl: 'local://reports/e2e-report-v2.pdf',
      })
      .expect(201)
    expect(corrected.body.version).toBe(2)
    expect(corrected.body.status).toBe('pending_review')
    correctedReportId = corrected.body.id

    await request(app.getHttpServer())
      .post(`/api/reports/${corrected.body.id}/publish`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)

    const latest = await request(app.getHttpServer())
      .get(`/api/reports/sample/${secondSampleId}/latest`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .expect(200)
    expect(latest.body.version).toBe(2)
    expect(latest.body.fields.vitaminD.value).toBe(31)

    const old = await prisma.report.findUnique({ where: { id: reportId } })
    expect(old?.status).toBe('archived')
  })

  it('auto-generates a six-section AI interpretation after report publication', async () => {
    const latest = await request(app.getHttpServer())
      .get(`/api/interpretations/report/${correctedReportId}/latest`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    interpretationId = latest.body.id
    expect(latest.body.status).toBe('generated')
    expect(latest.body.aiGenerated).toBe(true)
    expect(latest.body.sections.metricExplanation).toBeTruthy()
    expect(latest.body.sections.abnormalItems).toBeTruthy()
    expect(latest.body.sections.possibleFactors).toBeTruthy()
    expect(latest.body.sections.lifestyleAdvice).toBeTruthy()
    expect(latest.body.sections.retestAdvice).toBeTruthy()
    expect(latest.body.sections.disclaimer).toContain('不作为临床诊断依据')

    const customerView = await request(app.getHttpServer())
      .get(`/api/interpretations/report/${correctedReportId}/latest`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .expect(200)
    expect(customerView.body.contentHidden).toBe(true)
  })

  it('lets the nutritionist adopt and publish the interpretation', async () => {
    const adopted = await request(app.getHttpServer())
      .post(`/api/interpretations/${interpretationId}/adopt`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(adopted.body.status).toBe('reviewed')
    expect(adopted.body.reviewedBy).toBeTruthy()

    const published = await request(app.getHttpServer())
      .post(`/api/interpretations/${interpretationId}/publish`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(published.body.publishedAt).toBeTruthy()

    const customerView = await request(app.getHttpServer())
      .get(`/api/interpretations/report/${correctedReportId}/latest`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .expect(200)
    expect(customerView.body.contentHidden).toBe(false)
    expect(customerView.body.reviewed).toBe(true)
    expect(customerView.body.sections.lifestyleAdvice).toBeTruthy()

    const merchantView = await request(app.getHttpServer())
      .get(`/api/interpretations/report/${correctedReportId}/latest`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(merchantView.body.contentHidden).toBe(true)
  })

  it('blocks sensitive wording during review until it is corrected', async () => {
    const generated = await request(app.getHttpServer())
      .post(`/api/interpretations/report/${correctedReportId}/generate`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(generated.body.version).toBe(2)

    const blocked = await request(app.getHttpServer())
      .post(`/api/interpretations/${generated.body.id}/edit`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        sections: {
          metricExplanation: '指标说明',
          abnormalItems: '异常项说明',
          possibleFactors: '可能影响因素',
          lifestyleAdvice: '本方案可以治愈相关症状。',
          retestAdvice: '建议复查',
          disclaimer: '仅供健康参考',
        },
        note: '误写疗效表述',
      })
      .expect(201)
    expect(blocked.body.status).toBe('blocked')
    expect(blocked.body.sensitiveHits).toContain('治愈')

    await request(app.getHttpServer())
      .post(`/api/interpretations/${generated.body.id}/publish`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(400)

    const clean = await request(app.getHttpServer())
      .post(`/api/interpretations/${generated.body.id}/edit`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        sections: {
          metricExplanation: '指标说明',
          abnormalItems: '异常项说明',
          possibleFactors: '可能影响因素',
          lifestyleAdvice: '建议保持均衡饮食与规律作息。',
          retestAdvice: '建议复查',
          disclaimer: '仅供健康参考',
        },
      })
      .expect(201)
    expect(clean.body.status).toBe('reviewed')

    await request(app.getHttpServer())
      .post(`/api/interpretations/${generated.body.id}/publish`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
  })

  it('creates and publishes a nutrition plan for the customer', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/nutrition-plans')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        reportId: correctedReportId,
        interpretationId,
        cycle: '4 周',
        meals: {
          breakfast: '燕麦、鸡蛋与牛奶',
          lunch: '杂粮饭、深色蔬菜与瘦肉',
          dinner: '清淡蛋白质与蔬菜',
        },
        followUpNodes: [
          { day: 7, note: '第一次随访' },
          { day: 28, note: '周期结束复评' },
        ],
      })
      .expect(201)
    expect(created.body.status).toBe('draft')

    const published = await request(app.getHttpServer())
      .post(`/api/nutrition-plans/${created.body.id}/publish`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(published.body.status).toBe('published')

    const mine = await request(app.getHttpServer())
      .get('/api/nutrition-plans/me')
      .set('Authorization', `Bearer ${customer2Token}`)
      .expect(200)
    expect(mine.body.some((plan: { id: string }) => plan.id === created.body.id)).toBe(true)

    await request(app.getHttpServer())
      .get(`/api/nutrition-plans/report/${correctedReportId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(403)
  })

  it('denies cross-ownership interpretation access', async () => {
    await request(app.getHttpServer())
      .get(`/api/interpretations/report/${correctedReportId}/latest`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403)

    const alerts = await prisma.systemAlert.findMany({
      where: { type: 'interpretation_access_denied', subjectId: correctedReportId },
    })
    expect(alerts.length).toBeGreaterThanOrEqual(1)
  })

  it('runs the sales claim flow and shows the assigned customer', async () => {
    const claim = await request(app.getHttpServer())
      .post('/api/sales-workbench/claims')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ customerPhone: `213${suffix}` })
      .expect(201)
    expect(claim.body.status).toBe('pending')

    const confirmed = await request(app.getHttpServer())
      .post(`/api/sales-workbench/claims/${claim.body.id}/confirm`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({})
      .expect(201)
    expect(confirmed.body.status).toBe('confirmed')

    const customers = await request(app.getHttpServer())
      .get('/api/sales-workbench/customers')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200)
    expect(customers.body.some((item: { customerId: string }) => item.customerId === customer2Id)).toBe(
      true,
    )
  })

  it('lets the merchant assign a customer and calculates sales performance', async () => {
    await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/register-payment`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)

    await request(app.getHttpServer())
      .post(`/api/sales-workbench/merchant/customers/${customer1Id}/assign`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ salesId })
      .expect(201)

    const performance = await request(app.getHttpServer())
      .get('/api/sales-workbench/performance')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200)
    expect(performance.body.customerCount).toBe(2)
    expect(performance.body.orderCount).toBe(1)
    expect(performance.body.totalAmountCents).toBe(21900)
    expect(performance.body.avgOrderCents).toBe(21900)

    const merchantCustomers = await request(app.getHttpServer())
      .get('/api/sales-workbench/merchant/customers')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    const assigned = merchantCustomers.body.find(
      (item: { customerId: string }) => item.customerId === customer1Id,
    )
    expect(assigned.salesName).toBe('激活测试销售')

    const claims = await request(app.getHttpServer())
      .get('/api/sales-workbench/claims')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200)
    expect(claims.body.some((item: { status: string }) => item.status === 'confirmed')).toBe(true)
  })
})
