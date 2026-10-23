import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

type Template = { id: string; code: string; version: number }

describe('Box codes and labels (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let supplierToken: string
  let merchantToken: string
  let supplierId: string
  let merchantId: string
  let productId: string
  let orderId: string
  let codes: Array<{ id: string; code: string; status: string; channelId: string }>

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

    supplierId = await createAccount('supplier', `190${suffix}`, '盒码测试供应商')
    merchantId = await createAccount('merchant', `191${suffix}`, '盒码测试商家')
    supplierToken = await login(`190${suffix}`, 'Passw0rd')
    merchantToken = await login(`191${suffix}`, 'Passw0rd')

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
        skuCode: `BOX-${suffix}`,
        name: '盒码测试检测盒',
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
        batchNo: `BB-${suffix}`,
        productionDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 10,
      })
      .expect(201)

    await prisma.prepaidAccount.upsert({
      where: { merchantId },
      update: { availableCents: 500000, totalRechargeCents: 500000, frozenCents: 0, totalDeductedCents: 0 },
      create: { merchantId, availableCents: 500000, totalRechargeCents: 500000 },
    })

    const order = await request(app.getHttpServer())
      .post('/api/procurement-orders')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ items: [{ productId, quantity: 3 }] })
      .expect(201)
    orderId = order.body.id
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('generates one unique box code per procured unit, bound to the merchant channel', async () => {
    const channels = await request(app.getHttpServer())
      .get('/api/channels/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)

    const response = await request(app.getHttpServer())
      .post('/api/box-codes/generate')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ procurementOrderId: orderId })
      .expect(201)
    codes = response.body
    expect(codes).toHaveLength(3)
    expect(new Set(codes.map((item) => item.code)).size).toBe(3)
    expect(codes.every((item) => item.channelId === channels.body[0].id)).toBe(true)
    expect(codes.every((item) => item.status === 'generated')).toBe(true)

    const repeated = await request(app.getHttpServer())
      .post('/api/box-codes/generate')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ procurementOrderId: orderId })
      .expect(201)
    expect(repeated.body).toHaveLength(3)
  })

  it('exports labels and resolves a public box code', async () => {
    const labels = await request(app.getHttpServer())
      .get(`/api/box-codes/labels/${orderId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(labels.body).toHaveLength(3)
    expect(labels.body[0].qrPayload).toContain(labels.body[0].code)

    const resolved = await request(app.getHttpServer())
      .get(`/api/box-codes/resolve/${codes[0].code}`)
      .expect(200)
    expect(resolved.body.valid).toBe(true)
    expect(resolved.body.status).toBe('generated')
  })

  it('replaces a box code and voids the old one', async () => {
    const replaced = await request(app.getHttpServer())
      .post(`/api/box-codes/${codes[0].id}/replace`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)
    expect(replaced.body.code).not.toBe(codes[0].code)
    expect(replaced.body.status).toBe('generated')

    const oldCode = await prisma.boxCode.findUnique({ where: { id: codes[0].id } })
    expect(oldCode?.status).toBe('voided')
    expect(oldCode?.voidReason).toBe('补码作废')

    const resolved = await request(app.getHttpServer())
      .get(`/api/box-codes/resolve/${codes[0].code}`)
      .expect(200)
    expect(resolved.body.valid).toBe(false)
    expect(resolved.body.reason).toBe('VOIDED')

    codes[0] = replaced.body
  })

  it('refuses to void a used box code', async () => {
    await prisma.boxCode.update({
      where: { id: codes[1].id },
      data: { status: 'used', activatedAt: new Date() },
    })

    await request(app.getHttpServer())
      .post(`/api/box-codes/${codes[1].id}/void`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'test' })
      .expect(400)
  })

  it('voids unactivated codes when the procurement order is cancelled', async () => {
    const second = await request(app.getHttpServer())
      .post('/api/procurement-orders')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ items: [{ productId, quantity: 1 }] })
      .expect(201)
    const secondCodes = await request(app.getHttpServer())
      .post('/api/box-codes/generate')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ procurementOrderId: second.body.id })
      .expect(201)
    expect(secondCodes.body).toHaveLength(1)

    await request(app.getHttpServer())
      .post(`/api/procurement-orders/${second.body.id}/cancel`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(201)

    const voided = await prisma.boxCode.findUnique({
      where: { id: secondCodes.body[0].id },
    })
    expect(voided?.status).toBe('voided')
    expect(voided?.voidReason).toBe('采购单取消')
  })
})
