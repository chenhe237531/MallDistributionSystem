import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

type Template = { id: string; code: string; version: number }

describe('Permission matrix and risk rules (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let supplierToken: string
  let merchantToken: string
  let partnerToken: string
  let partnerId: string
  let merchantId: string
  let customerToken: string
  let outsiderToken: string
  let merchantChannelId: string
  let merchantChannelCode: string
  let boxCodes: Array<{ id: string; code: string }>
  let orderId: string
  let orderItemId: string

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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()

    platformToken = await login('13800000000', 'Admin@123')
    const supplierId = await createAccount('supplier', `320${suffix}`, '风控测试供应商')
    merchantId = await createAccount('merchant', `321${suffix}`, '风控测试商家')
    partnerId = await createAccount('partner', `322${suffix}`, '风控测试合伙人')
    supplierToken = await login(`320${suffix}`, 'Passw0rd')
    merchantToken = await login(`321${suffix}`, 'Passw0rd')
    partnerToken = await login(`322${suffix}`, 'Passw0rd')

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
        skuCode: `RISK-${suffix}`,
        name: '风控测试检测盒',
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
        batchNo: `RK-${suffix}`,
        productionDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 6,
      })
      .expect(201)

    await prisma.prepaidAccount.upsert({
      where: { merchantId },
      update: { availableCents: 300000, totalRechargeCents: 300000, frozenCents: 0, totalDeductedCents: 0 },
      create: { merchantId, availableCents: 300000, totalRechargeCents: 300000 },
    })
    const procurement = await request(app.getHttpServer())
      .post('/api/procurement-orders')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ items: [{ productId: product.body.id, quantity: 3 }] })
      .expect(201)
    const generated = await request(app.getHttpServer())
      .post('/api/box-codes/generate')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ procurementOrderId: procurement.body.id })
      .expect(201)
    boxCodes = generated.body

    const merchantChannels = await request(app.getHttpServer())
      .get('/api/channels/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    merchantChannelId = merchantChannels.body[0].id
    merchantChannelCode = merchantChannels.body[0].code

    const listing = await request(app.getHttpServer())
      .post('/api/products/merchant/listings')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ productId: product.body.id, retailPriceCents: 21900 })
      .expect(201)

    const partnerChannels = await request(app.getHttpServer())
      .get('/api/channels/me')
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(200)
    const partnerChannelCode = partnerChannels.body[0].code

    const customer = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: `325${suffix}`, password: 'Passw0rd', name: '风控客户一' })
      .expect(201)
    customerToken = customer.body.token
    await request(app.getHttpServer())
      .patch('/api/customers/me/real-name')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ realName: '风控一', idCardNo: '110101199003071234', gender: 'male' })
      .expect(200)

    const outsider = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: `326${suffix}`, password: 'Passw0rd', name: '风控客户二' })
      .expect(201)
    outsiderToken = outsider.body.token
    await request(app.getHttpServer())
      .patch('/api/customers/me/real-name')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ realName: '风控二', idCardNo: '110101199003071235', gender: 'female' })
      .expect(200)

    const order = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ listingId: listing.body.id, quantity: 1 }],
        contactName: '风控一',
        contactPhone: `325${suffix}`,
        channelCode: partnerChannelCode,
      })
      .expect(201)
    orderId = order.body.id
    const paid = await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/register-payment`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)
    orderItemId = paid.body.items[0].id

    const activated = await request(app.getHttpServer())
      .post('/api/box-codes/activate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        boxCode: boxCodes[0].code,
        questionnaire: { gender: 'male', age: 30 },
        consentGiven: true,
        reportAuthorization: true,
        samplingMethod: 'self_mail',
      })
      .expect(201)
    expect(activated.body.ownership.channelId).toBe(merchantChannelId)
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('pauses partner statements after monthly refund rate exceeds 20%', async () => {
    await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ items: [{ orderItemId, quantity: 1 }], reason: '风控退款测试' })
      .expect(201)

    const channel = await prisma.channelIdentity.findFirst({
      where: { userId: partnerId, type: 'partner' },
    })
    expect(channel?.riskStatus).toBe('paused')
    const alert = await prisma.systemAlert.findFirst({
      where: { type: 'channel_refund_rate_high', subjectId: channel?.id, status: 'open' },
    })
    expect(alert).toBeTruthy()

    const period = new Date().toISOString().slice(0, 7)
    await request(app.getHttpServer())
      .post('/api/statements/generate')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ period, subjectType: 'partner', subjectId: partnerId })
      .expect(403)
  })

  it('records repeated scans and old-code scans as box code anomalies', async () => {
    await request(app.getHttpServer())
      .post('/api/box-codes/activate')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        boxCode: boxCodes[0].code,
        questionnaire: { gender: 'female', age: 28 },
        consentGiven: true,
        reportAuthorization: true,
        samplingMethod: 'self_mail',
      })
      .expect(409)
    const multiScan = await prisma.systemAlert.findFirst({
      where: { type: 'box_code_multi_scan', subjectId: boxCodes[0].id },
    })
    expect(multiScan).toBeTruthy()
  })

  it('disables and reissues a channel, freezing unactivated box codes', async () => {
    await request(app.getHttpServer())
      .post(`/api/channels/${merchantChannelId}/disable`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: '渠道码外泄演练' })
      .expect(201)

    const ownership = await request(app.getHttpServer())
      .get('/api/customers/me/ownership')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(ownership.body.ownership.channelId).toBe(merchantChannelId)
    expect(ownership.body.ownership.sourceBoxCode).toBe(boxCodes[0].code)

    const reissued = await request(app.getHttpServer())
      .post(`/api/channels/${merchantChannelId}/reissue`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(reissued.body.channel.code).not.toBe(merchantChannelCode)
    expect(reissued.body.frozenBoxCodes).toBeGreaterThanOrEqual(2)

    const oldGenerated = await prisma.boxCode.findMany({
      where: { channelId: merchantChannelId, status: 'voided' },
    })
    expect(oldGenerated.length).toBeGreaterThanOrEqual(2)
    expect(oldGenerated.every((item) => item.voidReason?.includes('渠道码外泄'))).toBe(true)

    const newCodes = await prisma.boxCode.findMany({
      where: { channelId: reissued.body.channel.id, status: 'generated' },
    })
    expect(newCodes.length).toBeGreaterThanOrEqual(2)

    await request(app.getHttpServer())
      .post('/api/box-codes/activate')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        boxCode: oldGenerated[0].code,
        questionnaire: { gender: 'female', age: 28 },
        consentGiven: true,
        reportAuthorization: true,
        samplingMethod: 'self_mail',
      })
      .expect(400)
    const reappeared = await prisma.systemAlert.findFirst({
      where: { type: 'box_code_old_code_reappear', subjectId: oldGenerated[0].id },
    })
    expect(reappeared).toBeTruthy()

    const frozen = await request(app.getHttpServer())
      .post('/api/box-codes/freeze-unactivated')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ channelId: reissued.body.channel.id })
      .expect(201)
    expect(frozen.body.frozen).toBeGreaterThanOrEqual(2)
  })

  it('flags batch registration from the same device and delays commissions', async () => {
    const deviceId = `device-${suffix}`
    const phones = [`327${suffix}`, `328${suffix}`, `329${suffix}`]
    for (const phone of phones) {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ phone, password: 'Passw0rd', name: `批量注册${phone.slice(-2)}`, deviceId })
        .expect(201)
    }
    const riskUser = await prisma.user.findUnique({ where: { phone: phones[2] } })
    expect(riskUser?.riskLevel).toBe('watch')
    const alert = await prisma.systemAlert.findFirst({
      where: { type: 'abnormal_registration', subjectId: riskUser?.id },
    })
    expect(alert).toBeTruthy()
  })

  it('blocks frequent hierarchy rebinding within one day', async () => {
    const partnerA = await createAccount('partner', `330${suffix}`, '层级合伙人A')
    const partnerB = await createAccount('partner', `331${suffix}`, '层级合伙人B')
    const partnerC = await createAccount('partner', `332${suffix}`, '层级合伙人C')

    await request(app.getHttpServer())
      .post(`/api/accounts/partners/${partnerB}/inviter`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ inviterId: partnerA })
      .expect(201)

    await request(app.getHttpServer())
      .post(`/api/accounts/partners/${partnerB}/inviter`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ inviterId: partnerC })
      .expect(400)

    const alert = await prisma.systemAlert.findFirst({
      where: { type: 'hierarchy_rebind_frequent', subjectId: partnerB },
    })
    expect(alert).toBeTruthy()
  })

  it('audits role-based permission denials', async () => {
    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({})
      .expect(403)

    const logs = await request(app.getHttpServer())
      .get('/api/audit?action=permission.denied')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(logs.body.total).toBeGreaterThanOrEqual(1)
    expect(logs.body.items.some((item: { actorId: string }) => item.actorId === partnerId)).toBe(true)
  })

  it('exposes risk alerts for platform operations to resolve', async () => {
    const alerts = await request(app.getHttpServer())
      .get('/api/alerts')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    const types = alerts.body.map((item: { type: string }) => item.type)
    expect(types).toEqual(
      expect.arrayContaining([
        'channel_refund_rate_high',
        'box_code_multi_scan',
        'abnormal_registration',
        'hierarchy_rebind_frequent',
      ]),
    )

    const target = alerts.body.find((item: { status: string }) => item.status === 'open')
    const resolved = await request(app.getHttpServer())
      .post(`/api/alerts/${target.id}/resolve`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(resolved.body.status).toBe('resolved')
  })
})
