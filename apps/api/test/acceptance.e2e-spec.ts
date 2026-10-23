import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)
const period = new Date().toISOString().slice(0, 7)

type Template = { id: string; code: string; version: number }

describe('P0 acceptance: procurement to settlement (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let supplierToken: string
  let merchantToken: string
  let partner1Token: string
  let customerToken: string
  let supplierId: string
  let merchantId: string
  let partner1Id: string
  let partner2Id: string
  let productId: string
  let procurementOrderId: string
  let boxCode: string
  let orderId: string
  let reportId: string
  let interpretationId: string
  let sampleId: string

  const login = async (phone: string, password: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone, password })
      .expect(201)
    return response.body.token as string
  }

  const createAccount = async (
    role: 'merchant' | 'supplier' | 'partner',
    phone: string,
    name: string,
  ): Promise<string> => {
    const payload: Record<string, unknown> = {
      phone,
      password: 'Passw0rd',
      name,
      primaryRole: role,
    }
    if (role !== 'partner') {
      payload.organizationName = `${name}组织${suffix}`
    }
    const created = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send(payload)
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

  const settleStatement = async (
    subjectType: 'supplier' | 'merchant' | 'partner',
    subjectId: string,
    voucherSeq: string,
  ) => {
    const generated = await request(app.getHttpServer())
      .post('/api/statements/generate')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ period, subjectType, subjectId })
      .expect(201)
    const statement = generated.body as { id: string; totalPayableCents: number }
    expect(statement.totalPayableCents).toBeGreaterThan(0)

    await request(app.getHttpServer())
      .post(`/api/statements/${statement.id}/reconcile`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/statements/${statement.id}/vouchers`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        voucherNo: `INV-${suffix}-${voucherSeq}`,
        title: '检测服务费发票',
        amountCents: statement.totalPayableCents,
        issuedAt: new Date().toISOString(),
      })
      .expect(201)
    const settled = await request(app.getHttpServer())
      .post(`/api/statements/${statement.id}/settle`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(settled.body.status).toBe('settled')
    return statement
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()

    platformToken = await login('13800000000', 'Admin@123')
    supplierId = await createAccount('supplier', `340${suffix}`, '验收供应商')
    merchantId = await createAccount('merchant', `341${suffix}`, '验收商家')
    partner1Id = await createAccount('partner', `342${suffix}`, '验收一级合伙人')
    partner2Id = await createAccount('partner', `343${suffix}`, '验收二级合伙人')
    supplierToken = await login(`340${suffix}`, 'Passw0rd')
    merchantToken = await login(`341${suffix}`, 'Passw0rd')
    partner1Token = await login(`342${suffix}`, 'Passw0rd')

    const customer = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: `344${suffix}`, password: 'Passw0rd', name: '验收客户' })
      .expect(201)
    customerToken = customer.body.token
    await request(app.getHttpServer())
      .patch('/api/customers/me/real-name')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ realName: '验收客户', idCardNo: '110101199003071234', gender: 'male' })
      .expect(200)

    await request(app.getHttpServer())
      .post(`/api/accounts/partners/${partner1Id}/inviter`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ inviterId: partner2Id })
      .expect(201)

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
        skuCode: `ACC-${suffix}`,
        name: '验收检测盒',
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
        batchNo: `AC-${suffix}`,
        productionDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 5,
      })
      .expect(201)

    const effectiveFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await request(app.getHttpServer())
      .post('/api/commissions/rules')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ productId, level: 1, rateType: 'percentage', rateBps: 1000, effectiveFrom })
      .expect(201)
    await request(app.getHttpServer())
      .post('/api/commissions/rules')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ productId, level: 2, rateType: 'percentage', rateBps: 500, effectiveFrom })
      .expect(201)

    const recharge = await request(app.getHttpServer())
      .post('/api/prepaid/recharges')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ amountCents: 200000, voucherUrl: `local://acceptance/${suffix}.jpg` })
      .expect(201)
    const credited = await request(app.getHttpServer())
      .post(`/api/prepaid/recharges/${recharge.body.id}/credit`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reviewApproved: true })
      .expect(201)
    expect(credited.body.account.availableCents).toBe(200000)
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('runs procurement, labeling, payment, sampling, report, forward, reconciliation and settlement', async () => {
    const procurement = await request(app.getHttpServer())
      .post('/api/procurement-orders')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ items: [{ productId, quantity: 2 }] })
      .expect(201)
    procurementOrderId = procurement.body.id

    const codes = await request(app.getHttpServer())
      .post('/api/box-codes/generate')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ procurementOrderId })
      .expect(201)
    boxCode = codes.body[0].code

    const labels = await request(app.getHttpServer())
      .get(`/api/box-codes/labels/${procurementOrderId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(labels.body).toHaveLength(2)

    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${procurementOrderId}/confirm`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({})
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${procurementOrderId}/ship`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({})
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${procurementOrderId}/receive`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${procurementOrderId}/complete`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)

    const listing = await request(app.getHttpServer())
      .post('/api/products/merchant/listings')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ productId, retailPriceCents: 21900 })
      .expect(201)

    const partnerChannels = await request(app.getHttpServer())
      .get('/api/channels/me')
      .set('Authorization', `Bearer ${partner1Token}`)
      .expect(200)
    const partnerChannel = partnerChannels.body[0]

    await prisma.boxCode.update({
      where: { code: boxCode },
      data: { channelId: partnerChannel.id, merchantId },
    })

    const order = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ listingId: listing.body.id, quantity: 1 }],
        contactName: '验收客户',
        contactPhone: `344${suffix}`,
        channelCode: partnerChannel.code,
      })
      .expect(201)
    orderId = order.body.id

    await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/register-payment`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/ship`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)

    const activated = await request(app.getHttpServer())
      .post('/api/box-codes/activate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        boxCode,
        orderId,
        questionnaire: { gender: 'male', age: 35 },
        consentGiven: true,
        reportAuthorization: true,
        samplingMethod: 'self_mail',
      })
      .expect(201)
    sampleId = activated.body.sample.id
    expect(activated.body.ownership.channelId).toBe(partnerChannel.id)

    await request(app.getHttpServer())
      .post(`/api/samples/${sampleId}/mail`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ trackingNo: 'SF-ACC-001' })
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/samples/${sampleId}/receive`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        boxCodeMatched: true,
        samplingTimeValid: true,
        storageConditionOk: true,
        transitWithinLimit: true,
      })
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/samples/${sampleId}/testing`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)

    const report = await request(app.getHttpServer())
      .post('/api/reports')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        sampleId,
        fields: { vitaminD: { value: 32, unit: 'ng/mL', reference: '30-100' } },
        summary: '维生素 D 正常。',
        pdfUrl: 'local://reports/acceptance.pdf',
      })
      .expect(201)
    reportId = report.body.id
    await request(app.getHttpServer())
      .post(`/api/reports/${reportId}/submit`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/reports/${reportId}/publish`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)

    const latest = await request(app.getHttpServer())
      .get(`/api/interpretations/report/${reportId}/latest`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    interpretationId = latest.body.id
    expect(latest.body.status).toBe('generated')
    await request(app.getHttpServer())
      .post(`/api/interpretations/${interpretationId}/adopt`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/interpretations/${interpretationId}/publish`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)

    const share = await request(app.getHttpServer())
      .post('/api/report-shares')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ reportId, receiverPhone: `344${suffix}` })
      .expect(201)
    const opened = await request(app.getHttpServer())
      .get(`/api/report-shares/${share.body.token}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(opened.body.valid).toBe(true)

    await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)
    await prisma.salesOrder.update({
      where: { id: orderId },
      data: { completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    })
    const confirmed = await request(app.getHttpServer())
      .post('/api/commissions/confirm-eligible')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(confirmed.body.updated).toBeGreaterThanOrEqual(2)

    const commissions = await prisma.commission.findMany({
      where: { orderId, status: { not: 'invalid' } },
    })
    expect(commissions).toHaveLength(2)
    expect(commissions.every((item) => item.status === 'pending_reconciliation')).toBe(true)

    const supplierStatement = await settleStatement('supplier', supplierId, 'S')
    const merchantStatement = await settleStatement('merchant', merchantId, 'M')
    await settleStatement('partner', partner1Id, 'P1')
    await settleStatement('partner', partner2Id, 'P2')

    expect(supplierStatement.totalPayableCents).toBe(16000)
    expect(merchantStatement.totalPayableCents).toBe(8425)

    const notifications = await request(app.getHttpServer())
      .get('/api/notifications/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    const customerTypes = notifications.body.items.map((item: { type: string }) => item.type)
    expect(customerTypes).toEqual(
      expect.arrayContaining([
        'order_paid',
        'order_shipped',
        'sample_received',
        'interpretation_published',
        'report_shared',
      ]),
    )

    const merchantNotifications = await request(app.getHttpServer())
      .get('/api/notifications/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    const merchantTypes = merchantNotifications.body.items.map((item: { type: string }) => item.type)
    expect(merchantTypes).toEqual(
      expect.arrayContaining([
        'contract_active',
        'order_paid',
        'recharge_credited',
        'report_ready',
        'statement_generated',
        'voucher_registered',
      ]),
    )

    const audit = await request(app.getHttpServer())
      .get(`/api/audit?orderNo=${order.body.orderNo}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    const actions = audit.body.items.map((item: { action: string }) => item.action)
    expect(actions).toEqual(
      expect.arrayContaining([
        'order.create',
        'order.pay',
        'consent.agree',
        'sample.activate',
        'report.publish',
        'interpretation.publish',
        'report.forward',
        'commission.generate',
      ]),
    )
  })

  it('notifies the sales user after passing a course exam', async () => {
    const sales = await request(app.getHttpServer())
      .post('/api/accounts/sales')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ phone: `345${suffix}`, password: 'Passw0rd', name: '验收销售' })
      .expect(201)
    const salesToken = await login(`345${suffix}`, 'Passw0rd')

    const records = await request(app.getHttpServer())
      .get('/api/training/me')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200)
    const record = records.body.find(
      (item: { course: { code: string } }) => item.course.code === 'newbie_course',
    )
    expect(record).toBeTruthy()

    for (const chapter of record.course.chapters) {
      await request(app.getHttpServer())
        .post(`/api/training/records/${record.id}/chapters/${chapter.id}/complete`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({})
        .expect(201)
    }

    const course = await prisma.course.findUnique({
      where: { code: 'newbie_course' },
      include: { questions: true },
    })
    const answers: Record<string, string> = {}
    for (const question of course!.questions) {
      answers[question.id] = question.answer as string
    }
    const exam = await request(app.getHttpServer())
      .post(`/api/training/records/${record.id}/exam`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ answers })
      .expect(201)
    expect(exam.body.status).toBe('passed')
    expect(exam.body.examScore).toBeGreaterThanOrEqual(60)

    const notifications = await request(app.getHttpServer())
      .get('/api/notifications/me')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200)
    expect(
      notifications.body.items.some((item: { type: string }) => item.type === 'training_passed'),
    ).toBe(true)

    const audit = await request(app.getHttpServer())
      .get('/api/audit?resourceType=training')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(audit.body.total).toBeGreaterThanOrEqual(1)

    expect(sales.body.id).toBeTruthy()
  })
})
