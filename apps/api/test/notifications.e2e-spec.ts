import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

type Template = { id: string; code: string; version: number }

describe('Notifications, report sharing and audit trail (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let supplierToken: string
  let merchantToken: string
  let customerToken: string
  let outsiderToken: string
  let supplierId: string
  let merchantId: string
  let customerId: string
  let customerPhone: string
  let orderNo: string
  let reportId: string
  let interpretationId: string
  let boxCodeValue: string
  let channelCode: string
  let shareToken: string

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
    supplierId = await createAccount('supplier', `310${suffix}`, '通知测试供应商')
    merchantId = await createAccount('merchant', `311${suffix}`, '通知测试商家')
    supplierToken = await login(`310${suffix}`, 'Passw0rd')
    merchantToken = await login(`311${suffix}`, 'Passw0rd')

    customerPhone = `312${suffix}`
    const customer = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: customerPhone, password: 'Passw0rd', name: '通知测试客户' })
      .expect(201)
    customerToken = customer.body.token
    customerId = customer.body.user.id
    await request(app.getHttpServer())
      .patch('/api/customers/me/real-name')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ realName: '赵六', idCardNo: '110101199003071234', gender: 'male' })
      .expect(200)

    const outsider = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: `313${suffix}`, password: 'Passw0rd', name: '第三人' })
      .expect(201)
    outsiderToken = outsider.body.token

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
        skuCode: `NTF-${suffix}`,
        name: '通知测试检测盒',
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
    await request(app.getHttpServer())
      .post(`/api/products/${product.body.id}/review`)
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
      .post(`/api/products/${product.body.id}/batches`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        batchNo: `NT-${suffix}`,
        productionDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 3,
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
      .send({ items: [{ productId: product.body.id, quantity: 1 }] })
      .expect(201)
    const codes = await request(app.getHttpServer())
      .post('/api/box-codes/generate')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ procurementOrderId: procurement.body.id })
      .expect(201)
    boxCodeValue = codes.body[0].code

    const channels = await request(app.getHttpServer())
      .get('/api/channels/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    channelCode = channels.body[0].code

    const listing = await request(app.getHttpServer())
      .post('/api/products/merchant/listings')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ productId: product.body.id, retailPriceCents: 21900 })
      .expect(201)
    const order = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ listingId: listing.body.id, quantity: 1 }],
        contactName: '赵六',
        contactPhone: customerPhone,
        channelCode,
      })
      .expect(201)
    orderNo = order.body.orderNo

    const activated = await request(app.getHttpServer())
      .post('/api/box-codes/activate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        boxCode: boxCodeValue,
        orderId: order.body.id,
        questionnaire: { gender: 'male', age: 33 },
        consentGiven: true,
        reportAuthorization: true,
        samplingMethod: 'self_mail',
      })
      .expect(201)
    const sampleId = activated.body.sample.id

    await request(app.getHttpServer())
      .post(`/api/samples/${sampleId}/mail`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ trackingNo: 'SF-NTF-001' })
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
        fields: {
          vitaminD: { value: 25, unit: 'ng/mL', reference: '30-100' },
        },
        summary: '维生素 D 偏低，建议复查。',
        pdfUrl: 'local://reports/ntf-report.pdf',
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
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('creates one merchant report-ready notification with no report values', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/notifications/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    const items = response.body.items as Array<{
      type: string
      title: string
      body: string
      channel: string
      status: string
      failureReason: string | null
      payload: Record<string, unknown>
    }>
    const ready = items.filter((item) => item.type === 'report_ready')
    expect(ready).toHaveLength(1)
    expect(ready[0].title).toBe('报告已生成')
    expect(ready[0].body).not.toContain('维生素')
    expect(ready[0].body).not.toContain('25')
    expect(JSON.stringify(ready[0].payload)).not.toContain('vitaminD')
    expect(ready[0].channel).toBe('in_app')
    expect(ready[0].failureReason).toContain('站内消息兜底')
    expect(ready[0].status).toBe('sent')
  })

  it('does not duplicate the automatic reminder after interpretation re-publish', async () => {
    const latest = await request(app.getHttpServer())
      .get(`/api/interpretations/report/${reportId}/latest`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    interpretationId = latest.body.id
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

    const count = await prisma.notification.count({
      where: {
        type: 'report_ready',
        subjectId: reportId,
        recipientId: merchantId,
      },
    })
    expect(count).toBe(1)
  })

  it('aggregates report forwarding tasks by merchant', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/notifications/report-tasks')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(response.body).toHaveLength(1)
    expect(response.body[0].merchantId).toBe(merchantId)
    expect(response.body[0].pendingCount).toBe(1)
    expect(response.body[0].overdueCount).toBe(0)
    expect(response.body[0].tasks[0].reportId).toBe(reportId)
  })

  it('rejects forwarding to a phone that is not the order customer', async () => {
    await request(app.getHttpServer())
      .post('/api/report-shares')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ reportId, receiverPhone: `399${suffix}` })
      .expect(400)
  })

  it('creates a share that only the order customer can open', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/report-shares')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ reportId, receiverPhone: customerPhone })
      .expect(201)
    shareToken = created.body.token

    await request(app.getHttpServer())
      .get(`/api/report-shares/${shareToken}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403)

    const opened = await request(app.getHttpServer())
      .get(`/api/report-shares/${shareToken}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(opened.body.valid).toBe(true)
    expect(opened.body.report.id).toBe(reportId)
    expect(opened.body.entry).toBe(`/reports/${reportId}`)

    const customerNotifications = await request(app.getHttpServer())
      .get('/api/notifications/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(
      customerNotifications.body.items.some((item: { type: string }) => item.type === 'report_shared'),
    ).toBe(true)

    const tasks = await request(app.getHttpServer())
      .get('/api/notifications/report-tasks')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(tasks.body).toHaveLength(0)
  })

  it('marks overdue tasks and creates a platform alert once', async () => {
    await prisma.reminder.updateMany({
      where: { type: 'report_forward', subjectId: reportId },
      data: { status: 'pending', dueAt: new Date(Date.now() - 60 * 60 * 1000) },
    })

    const tasks = await request(app.getHttpServer())
      .get('/api/notifications/report-tasks')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(tasks.body[0].overdueCount).toBe(1)
    expect(tasks.body[0].tasks[0].overdue).toBe(true)

    const scanned = await request(app.getHttpServer())
      .post('/api/notifications/report-tasks/scan')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(scanned.body.alertsCreated).toBe(1)

    const repeated = await request(app.getHttpServer())
      .post('/api/notifications/report-tasks/scan')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(repeated.body.alertsCreated).toBe(0)
  })

  it('lets the recipient mark a notification as read only for themselves', async () => {
    const mine = await request(app.getHttpServer())
      .get('/api/notifications/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    const ready = mine.body.items.find((item: { type: string }) => item.type === 'report_ready')

    await request(app.getHttpServer())
      .post(`/api/notifications/${ready.id}/read`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({})
      .expect(403)

    const read = await request(app.getHttpServer())
      .post(`/api/notifications/${ready.id}/read`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)
    expect(read.body.status).toBe('read')
    expect(read.body.readAt).toBeTruthy()
  })

  it('alerts on high-frequency report viewing and audits cross-ownership denial', async () => {
    for (let index = 0; index < 6; index += 1) {
      await request(app.getHttpServer())
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
    }
    const alert = await prisma.systemAlert.findFirst({
      where: { type: 'report_high_frequency_view', subjectId: reportId, status: 'open' },
    })
    expect(alert).toBeTruthy()

    await request(app.getHttpServer())
      .get(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403)
    const deniedLogs = await request(app.getHttpServer())
      .get('/api/audit?action=report.access_denied')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(deniedLogs.body.total).toBeGreaterThanOrEqual(1)
  })

  it('searches the audit trail by order, box code, customer and channel', async () => {
    const byOrder = await request(app.getHttpServer())
      .get(`/api/audit?orderNo=${orderNo}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(byOrder.body.total).toBeGreaterThanOrEqual(4)
    const actions = byOrder.body.items.map((item: { action: string }) => item.action)
    expect(actions).toEqual(
      expect.arrayContaining(['order.create', 'consent.agree', 'sample.activate', 'report.publish']),
    )

    const byBox = await request(app.getHttpServer())
      .get(`/api/audit?boxCode=${boxCodeValue}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(byBox.body.total).toBeGreaterThanOrEqual(2)

    const byCustomer = await request(app.getHttpServer())
      .get(`/api/audit?customer=${customerPhone}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(
      byCustomer.body.items.some((item: { customerId: string }) => item.customerId === customerId),
    ).toBe(true)

    const byChannel = await request(app.getHttpServer())
      .get(`/api/audit?channelCode=${channelCode}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(byChannel.body.total).toBeGreaterThanOrEqual(2)

    const contractLogs = await request(app.getHttpServer())
      .get('/api/audit?resourceType=contract')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(contractLogs.body.total).toBeGreaterThanOrEqual(6)
  })

  it('isolates audit results by role ownership', async () => {
    const outsider = await request(app.getHttpServer())
      .get(`/api/audit?orderNo=${orderNo}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(200)
    expect(outsider.body.total).toBe(0)

    const otherCustomer = await request(app.getHttpServer())
      .get(`/api/audit?orderNo=${orderNo}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(otherCustomer.body.total).toBeGreaterThan(0)
  })

  it('records material generation in the audit trail', async () => {
    const templates = await request(app.getHttpServer())
      .get('/api/materials/templates')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    const template = (templates.body as Array<{ id: string; code: string }>).find(
      (item) => item.code === 'moments_copy',
    )!
    await request(app.getHttpServer())
      .post('/api/materials/generate')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ templateId: template.id, storeName: '通知测试门店', storeAddress: '上海市' })
      .expect(201)

    const logs = await request(app.getHttpServer())
      .get('/api/audit?resourceType=material')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(logs.body.total).toBeGreaterThanOrEqual(1)
    expect(logs.body.items[0].action).toBe('material.generate')
  })

  it('exports an audited evidence package and logs the exporter purpose', async () => {
    await request(app.getHttpServer())
      .get(`/api/audit/export?format=excel&orderNo=${orderNo}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(400)

    const exported = await request(app.getHttpServer())
      .get(`/api/audit/export?format=excel&orderNo=${orderNo}&purpose=${encodeURIComponent('客诉核查')}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(exported.headers['content-type']).toContain('spreadsheetml')

    const pdf = await request(app.getHttpServer())
      .get(`/api/audit/export?format=pdf&customer=${customerPhone}&purpose=${encodeURIComponent('合规抽检')}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(pdf.headers['content-type']).toContain('application/pdf')

    await request(app.getHttpServer())
      .get(`/api/audit/export?format=excel&orderNo=${orderNo}&purpose=${encodeURIComponent('越权尝试')}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403)

    const exportLogs = await request(app.getHttpServer())
      .get('/api/audit?action=audit.export')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(exportLogs.body.total).toBeGreaterThanOrEqual(2)
    expect(exportLogs.body.items[0].detail.purpose).toBeTruthy()

    const denied = await request(app.getHttpServer())
      .get('/api/audit?action=permission.denied')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(denied.body.total).toBeGreaterThanOrEqual(1)
  })
})
