import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

type Template = { id: string; code: string; version: number }

describe('Sales orders, snapshots and refunds (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let supplierToken: string
  let merchantToken: string
  let customerToken: string
  let supplierId: string
  let merchantId: string
  let customerId: string
  let productId: string
  let listingId: string
  let batchId: string
  let channelCode: string
  let orderId: string

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

  const createOrder = async (quantity: number) => {
    const response = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ listingId, quantity }],
        contactName: '测试客户',
        contactPhone: `199${suffix}`,
        address: '杭州市西湖区测试路 1 号',
        channelCode,
      })
      .expect(201)
    return response.body as {
      id: string
      totalAmountCents: number
      status: string
      items: Array<{
        id: string
        unitPriceCents: number
        supplyPriceCents: number
        platformServiceRateBps: number
        commissionRateCapBps: number
      }>
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()

    platformToken = await login('13800000000', 'Admin@123')

    supplierId = await createAccount('supplier', `200${suffix}`, '销售测试供应商')
    merchantId = await createAccount('merchant', `201${suffix}`, '销售测试商家')
    supplierToken = await login(`200${suffix}`, 'Passw0rd')
    merchantToken = await login(`201${suffix}`, 'Passw0rd')

    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: `202${suffix}`, password: 'Passw0rd', name: '销售测试客户' })
      .expect(201)
    customerToken = registered.body.token
    customerId = registered.body.user.id

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
        skuCode: `SALE-${suffix}`,
        name: '销售测试检测盒',
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
    const batch = await request(app.getHttpServer())
      .post(`/api/products/${productId}/batches`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        batchNo: `SB-${suffix}`,
        productionDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 10,
      })
      .expect(201)
    batchId = batch.body.id

    const listing = await request(app.getHttpServer())
      .post('/api/products/merchant/listings')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ productId, retailPriceCents: 21900 })
      .expect(201)
    listingId = listing.body.id

    const channels = await request(app.getHttpServer())
      .get('/api/channels/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    channelCode = channels.body[0].code
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('shows the storefront for a channel code', async () => {
    const storefront = await request(app.getHttpServer())
      .get(`/api/sales-orders/storefront?channelCode=${channelCode}`)
      .expect(200)
    expect(storefront.body).toHaveLength(1)
    expect(storefront.body[0].listingId).toBe(listingId)
    expect(storefront.body[0].retailPriceCents).toBe(21900)
    expect(storefront.body[0].available).toBe(10)
  })

  it('creates an order with frozen price and commission snapshots', async () => {
    const order = await createOrder(2)
    orderId = order.id
    expect(order.status).toBe('pending_payment')
    expect(order.totalAmountCents).toBe(43800)
    expect(order.items[0].unitPriceCents).toBe(21900)
    expect(order.items[0].supplyPriceCents).toBe(8000)
    expect(order.items[0].platformServiceRateBps).toBe(1000)
    expect(order.items[0].commissionRateCapBps).toBe(2000)

    const detail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(detail.body.preAttributionChannelType).toBe('merchant')
    expect(detail.body.commissionRuleVersion).toBe('v1')
  })

  it('deducts stock when payment is registered and is idempotent', async () => {
    await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/register-payment`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)

    let batch = await prisma.batch.findUnique({ where: { id: batchId } })
    expect(batch?.remaining).toBe(8)

    const repeated = await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/register-payment`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)
    expect(repeated.body.status).toBe('paid')

    batch = await prisma.batch.findUnique({ where: { id: batchId } })
    expect(batch?.remaining).toBe(8)
  })

  it('walks the order state machine to completed', async () => {
    for (const [action, token] of [
      ['ship', merchantToken],
      ['deliver', merchantToken],
      ['mark-testing', platformToken],
      ['mark-report-ready', platformToken],
      ['complete', merchantToken],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/api/sales-orders/${orderId}/${action}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201)
    }

    const detail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(detail.body.status).toBe('completed')
  })

  it('supports partial and full refunds with proportional amounts and restock', async () => {
    const partial = await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ items: [{ quantity: 1 }] })
      .expect(400)
    expect(partial.body.message).toBeDefined()

    const order = await request(app.getHttpServer())
      .get(`/api/sales-orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    const itemId = order.body.items[0].id

    const first = await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ items: [{ orderItemId: itemId, quantity: 1 }], reason: '部分退款' })
      .expect(201)
    expect(first.body.refundedAmountCents).toBe(21900)
    expect(first.body.status).toBe('after_sale')

    let batch = await prisma.batch.findUnique({ where: { id: batchId } })
    expect(batch?.remaining).toBe(9)

    const second = await request(app.getHttpServer())
      .post(`/api/sales-orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ items: [{ orderItemId: itemId, quantity: 1 }], reason: '剩余退款' })
      .expect(201)
    expect(second.body.refundedAmountCents).toBe(43800)
    expect(second.body.status).toBe('refunded')

    batch = await prisma.batch.findUnique({ where: { id: batchId } })
    expect(batch?.remaining).toBe(10)
  })

  it('auto-closes unpaid orders after 30 minutes', async () => {
    const order = await createOrder(1)
    await prisma.salesOrder.update({
      where: { id: order.id },
      data: { createdAt: new Date(Date.now() - 31 * 60 * 1000) },
    })

    const closed = await request(app.getHttpServer())
      .post('/api/sales-orders/close-expired')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)
    expect(closed.body.closed).toBeGreaterThanOrEqual(1)

    const detail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${order.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(detail.body.status).toBe('cancelled')
  })
})
