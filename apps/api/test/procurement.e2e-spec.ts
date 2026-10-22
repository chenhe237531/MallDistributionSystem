import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

type Template = { id: string; code: string; version: number }

describe('Procurement orders (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let supplierToken: string
  let merchantToken: string
  let supplierId: string
  let merchantId: string
  let productId: string
  let batchId: string

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
      .post('/api/procurement-orders')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ items: [{ productId, quantity }], remark: '测试采购' })
      .expect(201)
    return response.body as { id: string; totalAmountCents: number; status: string }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()

    platformToken = await login('13800000000', 'Admin@123')

    supplierId = await createAccount('supplier', `180${suffix}`, '采购测试供应商')
    merchantId = await createAccount('merchant', `181${suffix}`, '采购测试商家')
    supplierToken = await login(`180${suffix}`, 'Passw0rd')
    merchantToken = await login(`181${suffix}`, 'Passw0rd')

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
        skuCode: `PROC-${suffix}`,
        name: '采购测试检测盒',
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
        batchNo: `PB-${suffix}`,
        productionDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 10,
      })
      .expect(201)
    batchId = batch.body.id

    await prisma.prepaidAccount.upsert({
      where: { merchantId },
      update: { availableCents: 500000, totalRechargeCents: 500000, frozenCents: 0, totalDeductedCents: 0 },
      create: {
        merchantId,
        availableCents: 500000,
        totalRechargeCents: 500000,
      },
    })
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('freezes prepaid balance and locks batch stock on submission', async () => {
    const order = await createOrder(3)
    expect(order.status).toBe('deducted')
    expect(order.totalAmountCents).toBe(24000)

    const prepaid = await request(app.getHttpServer())
      .get('/api/prepaid/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(prepaid.body.account.availableCents).toBe(476000)
    expect(prepaid.body.account.frozenCents).toBe(24000)
    expect(prepaid.body.integrity.ok).toBe(true)

    const batch = await prisma.batch.findUnique({ where: { id: batchId } })
    expect(batch?.remaining).toBe(7)

    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${order.id}/ship`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${order.id}/receive`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${order.id}/complete`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)
  })

  it('blocks procurement when batch stock is insufficient', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/procurement-orders')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ items: [{ productId, quantity: 100 }] })
      .expect(400)
    expect(response.body.message).toContain('库存不足')

    const batch = await prisma.batch.findUnique({ where: { id: batchId } })
    expect(batch?.remaining).toBe(7)
  })

  it('runs the full receive flow and settles the frozen amount', async () => {
    const order = await createOrder(3)
    expect(order.status).toBe('deducted')

    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${order.id}/ship`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(201)

    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${order.id}/ship`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(403)

    const received = await request(app.getHttpServer())
      .post(`/api/procurement-orders/${order.id}/receive`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(201)
    expect(received.body.status).toBe('received')

    const completed = await request(app.getHttpServer())
      .post(`/api/procurement-orders/${order.id}/complete`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)
    expect(completed.body.status).toBe('completed')

    const prepaid = await request(app.getHttpServer())
      .get('/api/prepaid/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(prepaid.body.account.frozenCents).toBe(0)
    expect(prepaid.body.account.totalDeductedCents).toBe(48000)
    expect(prepaid.body.account.availableCents).toBe(452000)
  })

  it('cancels an unshipped order, releasing balance and stock', async () => {
    const order = await createOrder(2)
    const cancelled = await request(app.getHttpServer())
      .post(`/api/procurement-orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(201)
    expect(cancelled.body.status).toBe('cancelled')

    const prepaid = await request(app.getHttpServer())
      .get('/api/prepaid/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(prepaid.body.account.availableCents).toBe(452000)
    expect(prepaid.body.account.frozenCents).toBe(0)

    const batch = await prisma.batch.findUnique({ where: { id: batchId } })
    expect(batch?.remaining).toBe(4)
  })

  it('refunds a received order and restocks the batch', async () => {
    const beforeRefund = await createOrder(2)
    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${beforeRefund.id}/confirm`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${beforeRefund.id}/ship`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${beforeRefund.id}/receive`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(201)

    const refunded = await request(app.getHttpServer())
      .post(`/api/procurement-orders/${beforeRefund.id}/refund`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)
    expect(refunded.body.status).toBe('refunded')

    const prepaid = await request(app.getHttpServer())
      .get('/api/prepaid/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(prepaid.body.account.totalDeductedCents).toBe(48000)
    expect(prepaid.body.account.availableCents).toBe(452000)

    const batch = await prisma.batch.findUnique({ where: { id: batchId } })
    expect(batch?.remaining).toBe(4)

    const supplierOrders = await request(app.getHttpServer())
      .get('/api/procurement-orders')
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(200)
    expect(supplierOrders.body.length).toBeGreaterThanOrEqual(4)
  })
})
