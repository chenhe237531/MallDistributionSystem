import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

type Template = { id: string; code: string; version: number }

describe('Two-level commissions and order split (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let supplierToken: string
  let merchantToken: string
  let partnerAToken: string
  let customerToken: string
  let supplierId: string
  let merchantId: string
  let partnerAId: string
  let partnerBId: string
  let customerId: string
  let productId: string
  let listingId: string
  let partnerAChannelCode: string
  let firstOrderId: string

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
    organizationName?: string,
  ): Promise<string> => {
    const created = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ phone, password: 'Passw0rd', name, primaryRole: role, organizationName })
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

  const createOrder = async (quantity: number) => {
    const order = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ listingId, quantity }],
        contactName: '佣金测试客户',
        contactPhone: `229${suffix}`,
        channelCode: partnerAChannelCode,
      })
      .expect(201)
    return order.body as { id: string; totalAmountCents: number }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()

    platformToken = await login('13800000000', 'Admin@123')

    supplierId = await createAccount('supplier', `220${suffix}`, '佣金测试供应商', `佣金供应商组织${suffix}`)
    merchantId = await createAccount('merchant', `221${suffix}`, '佣金测试商家', `佣金商家组织${suffix}`)
    partnerAId = await createAccount('partner', `222${suffix}`, '合伙人 A')
    partnerBId = await createAccount('partner', `223${suffix}`, '合伙人 B')
    supplierToken = await login(`220${suffix}`, 'Passw0rd')
    merchantToken = await login(`221${suffix}`, 'Passw0rd')
    partnerAToken = await login(`222${suffix}`, 'Passw0rd')

    const customer = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: `224${suffix}`, password: 'Passw0rd', name: '佣金测试客户' })
      .expect(201)
    customerToken = customer.body.token
    customerId = customer.body.user.id
    await request(app.getHttpServer())
      .patch('/api/customers/me/real-name')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ realName: '赵六', idCardNo: '110101199003071234' })
      .expect(200)

    await request(app.getHttpServer())
      .post(`/api/accounts/partners/${partnerAId}/inviter`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ inviterId: partnerBId })
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
        skuCode: `COM-${suffix}`,
        name: '佣金测试检测盒',
        testItems: ['维生素D'],
        sampleType: '指尖血',
        samplingMethod: '自行采样',
        storageCondition: '常温',
        shelfLifeDays: 365,
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
        batchNo: `CB-${suffix}`,
        productionDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 20,
      })
      .expect(201)

    const listing = await request(app.getHttpServer())
      .post('/api/products/merchant/listings')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ productId, retailPriceCents: 21900 })
      .expect(201)
    listingId = listing.body.id

    const partnerChannels = await request(app.getHttpServer())
      .get('/api/channels/me')
      .set('Authorization', `Bearer ${partnerAToken}`)
      .expect(200)
    partnerAChannelCode = partnerChannels.body[0].code

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

    await request(app.getHttpServer())
      .post('/api/commissions/rules')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ productId, level: 1, rateType: 'percentage', rateBps: 2000, effectiveFrom })
      .expect(400)
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('generates level-1 and level-2 commissions with an order split snapshot', async () => {
    const order = await createOrder(2)
    firstOrderId = order.id
    expect(order.totalAmountCents).toBe(43800)

    await request(app.getHttpServer())
      .post(`/api/sales-orders/${order.id}/register-payment`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)

    const commissions = await request(app.getHttpServer())
      .get(`/api/commissions/order/${order.id}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(commissions.body).toHaveLength(2)
    const level1 = commissions.body.find((item: { level: number }) => item.level === 1)
    const level2 = commissions.body.find((item: { level: number }) => item.level === 2)
    expect(level1.beneficiaryId).toBe(partnerAId)
    expect(level1.amountCents).toBe(4380)
    expect(level2.beneficiaryId).toBe(partnerBId)
    expect(level2.amountCents).toBe(2190)
    expect(level1.status).toBe('estimated')
    expect(level2.status).toBe('estimated')
    expect(level1.ruleVersion).toBeTruthy()

    const split = await request(app.getHttpServer())
      .get(`/api/commissions/order/${order.id}/split`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(split.body.settlements).toHaveLength(1)
    const settlement = split.body.settlements[0]
    expect(settlement.supplyCostCents).toBe(16000)
    expect(settlement.platformServiceFeeCents).toBe(4380)
    expect(settlement.level1CommissionCents).toBe(4380)
    expect(settlement.level2CommissionCents).toBe(2190)
    expect(settlement.merchantIncomeCents).toBe(43800 - 16000 - 4380 - 4380 - 2190)

    const repeat = await request(app.getHttpServer())
      .post(`/api/sales-orders/${order.id}/register-payment`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)
    expect(repeat.body.status).toBe('paid')
    const afterRepeat = await prisma.commission.count({ where: { orderId: order.id } })
    expect(afterRepeat).toBe(2)
  })

  it('marks self-purchase commissions invalid while keeping the record', async () => {
    await prisma.user.update({
      where: { id: partnerAId },
      data: { realName: '赵六', idCardNo: '110101199003071234' },
    })

    const order = await createOrder(1)
    await request(app.getHttpServer())
      .post(`/api/sales-orders/${order.id}/register-payment`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)

    const commissions = await request(app.getHttpServer())
      .get(`/api/commissions/order/${order.id}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    const level1 = commissions.body.find((item: { level: number }) => item.level === 1)
    const level2 = commissions.body.find((item: { level: number }) => item.level === 2)
    expect(level1.selfPurchase).toBe(true)
    expect(level1.status).toBe('invalid')
    expect(level2.selfPurchase).toBe(false)
    expect(level2.status).toBe('estimated')

    await prisma.user.update({
      where: { id: partnerAId },
      data: { realName: null, idCardNo: null },
    })
  })

  it('reverses commissions proportionally on partial and full refunds', async () => {
    const order = await createOrder(2)
    await request(app.getHttpServer())
      .post(`/api/sales-orders/${order.id}/register-payment`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)

    const detail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${order.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    const itemId = detail.body.items[0].id

    await request(app.getHttpServer())
      .post(`/api/sales-orders/${order.id}/refund`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ items: [{ orderItemId: itemId, quantity: 1 }], reason: '部分退款' })
      .expect(201)

    let commissions = await request(app.getHttpServer())
      .get(`/api/commissions/order/${order.id}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    const level1AfterPartial = commissions.body.find(
      (item: { level: number }) => item.level === 1,
    )
    expect(level1AfterPartial.reversedAmountCents).toBe(2190)

    await request(app.getHttpServer())
      .post(`/api/sales-orders/${order.id}/refund`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ items: [{ orderItemId: itemId, quantity: 1 }], reason: '剩余退款' })
      .expect(201)

    commissions = await request(app.getHttpServer())
      .get(`/api/commissions/order/${order.id}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    const level1AfterFull = commissions.body.find(
      (item: { level: number }) => item.level === 1,
    )
    expect(level1AfterFull.reversedAmountCents).toBe(4380)
    expect(level1AfterFull.status).toBe('invalid')
  })

  it('moves commissions to pending reconciliation after the 7-day sale period', async () => {
    for (const [action, token] of [
      ['ship', merchantToken],
      ['deliver', merchantToken],
      ['mark-testing', platformToken],
      ['mark-report-ready', platformToken],
      ['complete', merchantToken],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/api/sales-orders/${firstOrderId}/${action}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201)
    }
    await prisma.salesOrder.update({
      where: { id: firstOrderId },
      data: { completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    })

    const result = await request(app.getHttpServer())
      .post('/api/commissions/confirm-eligible')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(result.body.updated).toBeGreaterThanOrEqual(2)

    const commissions = await request(app.getHttpServer())
      .get(`/api/commissions/order/${firstOrderId}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(
      commissions.body.every(
        (item: { status: string }) => item.status === 'pending_reconciliation',
      ),
    ).toBe(true)

    const partnerCommissions = await request(app.getHttpServer())
      .get('/api/commissions/me')
      .set('Authorization', `Bearer ${partnerAToken}`)
      .expect(200)
    expect(partnerCommissions.body.length).toBeGreaterThanOrEqual(1)
    expect(partnerCommissions.body[0].beneficiaryId).toBe(partnerAId)
  })

  it('generates a partner statement with drill-down lines and enforces settlement rules', async () => {
    const channel = await prisma.channelIdentity.findFirst({
      where: { userId: partnerAId, type: 'partner' },
    })
    expect(channel?.riskStatus).toBe('paused')
    await request(app.getHttpServer())
      .post(`/api/channels/${channel?.id}/resume`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)

    const period = new Date().toISOString().slice(0, 7)
    const statement = await request(app.getHttpServer())
      .post('/api/statements/generate')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ period, subjectType: 'partner', subjectId: partnerAId })
      .expect(201)
    expect(statement.body.period).toBe(period)
    expect(statement.body.totalPayableCents).toBe(4380)
    expect(statement.body.lines).toHaveLength(1)
    expect(statement.body.lines[0]).toMatchObject({
      sourceType: 'commission',
      baseAmountCents: 43800,
      rateBps: 1000,
      level: 1,
      amountCents: 4380,
    })

    await request(app.getHttpServer())
      .post(`/api/statements/${statement.body.id}/vouchers`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        voucherNo: `INV-A-${suffix}`,
        title: '合伙人服务费发票',
        amountCents: 2000,
        issuedAt: new Date().toISOString(),
      })
      .expect(201)

    await request(app.getHttpServer())
      .post(`/api/statements/${statement.body.id}/settle`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(400)

    const full = await request(app.getHttpServer())
      .post(`/api/statements/${statement.body.id}/vouchers`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        voucherNo: `INV-A2-${suffix}`,
        title: '合伙人服务费收据',
        amountCents: 2380,
        issuedAt: new Date().toISOString(),
      })
      .expect(201)
    expect(full.body.voucherMissingCents).toBe(0)

    await request(app.getHttpServer())
      .post(`/api/statements/${statement.body.id}/vouchers`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        voucherNo: `INV-A-${suffix}`,
        title: '重复票证',
        amountCents: 1,
        issuedAt: new Date().toISOString(),
      })
      .expect(409)

    await request(app.getHttpServer())
      .post(`/api/statements/${statement.body.id}/reconcile`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)

    const settled = await request(app.getHttpServer())
      .post(`/api/statements/${statement.body.id}/settle`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(settled.body.status).toBe('settled')
  })

  it('flags voucher overpayment as a difference and allows resolution', async () => {
    const period = new Date().toISOString().slice(0, 7)
    const statement = await request(app.getHttpServer())
      .post('/api/statements/generate')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ period, subjectType: 'merchant', subjectId: merchantId })
      .expect(201)
    expect(statement.body.lines.length).toBeGreaterThanOrEqual(3)
    const total = statement.body.totalPayableCents as number

    const withDifference = await request(app.getHttpServer())
      .post(`/api/statements/${statement.body.id}/vouchers`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        voucherNo: `INV-M-${suffix}`,
        title: '商家收入发票',
        amountCents: total + 1000,
        issuedAt: new Date().toISOString(),
      })
      .expect(201)
    expect(withDifference.body.status).toBe('disputed')
    expect(withDifference.body.differences).toHaveLength(1)
    expect(withDifference.body.differences[0].amountCents).toBe(1000)

    const resolved = await request(app.getHttpServer())
      .post(
        `/api/statements/${statement.body.id}/differences/${withDifference.body.differences[0].id}/resolve`,
      )
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ resolution: '确认票证金额高于应付，差额下期抵扣' })
      .expect(201)
    expect(resolved.body.status).toBe('resolved')

    const settled = await request(app.getHttpServer())
      .post(`/api/statements/${statement.body.id}/settle`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(settled.body.status).toBe('settled')
  })

  it('reports the statement overview and exports Excel and PDF', async () => {
    const overview = await request(app.getHttpServer())
      .get('/api/statements/overview')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(overview.body.totalPayableCents).toBeGreaterThan(0)

    const statements = await request(app.getHttpServer())
      .get('/api/statements')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    const statement = statements.body[0]

    const excel = await request(app.getHttpServer())
      .get(`/api/statements/${statement.id}/export?format=xlsx`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(excel.headers['content-type']).toContain('spreadsheetml')

    const pdf = await request(app.getHttpServer())
      .get(`/api/statements/${statement.id}/export?format=pdf`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(pdf.headers['content-type']).toContain('application/pdf')
  })
})
