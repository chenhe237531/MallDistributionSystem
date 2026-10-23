import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

type Template = { id: string; code: string }

describe('Products, batches and inventory (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let supplierToken: string
  let merchantToken: string
  let supplierId: string
  let merchantId: string
  let productId: string
  let batchNearId: string
  let batchFarId: string

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
        organizationName: `${name}组织`,
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

    supplierToken = ''
    merchantToken = ''

    supplierId = await createAccount('supplier', `160${suffix}`, '商品测试供应商')
    merchantId = await createAccount('merchant', `161${suffix}`, '商品测试商家')
    supplierToken = await login(`160${suffix}`, 'Passw0rd')
    merchantToken = await login(`161${suffix}`, 'Passw0rd')

    const templatesResponse = await request(app.getHttpServer())
      .get('/api/contracts/templates')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    const templates = templatesResponse.body as Template[]
    await activateContract(
      templates.find((item) => item.code === 'supplier_supply')!.id,
      supplierId,
      supplierToken,
    )
    await activateContract(
      templates.find((item) => item.code === 'merchant_onboarding')!.id,
      merchantId,
      merchantToken,
    )
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('lets a supplier create a SKU and platform approve pricing', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        skuCode: `SKU-${suffix}`,
        name: '居家健康检测盒',
        testItems: ['维生素D', '铁蛋白'],
        sampleType: '指尖血',
        samplingMethod: '自行采样寄回',
        storageCondition: '2-8℃ 避光',
        shelfLifeDays: 365,
        supplyPriceCents: 8000,
        suggestedRetailPriceCents: 19900,
        distributable: true,
      })
      .expect(201)
    expect(created.body.status).toBe('draft')
    productId = created.body.id

    const reviewed = await request(app.getHttpServer())
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
    expect(reviewed.body.status).toBe('active')
    expect(reviewed.body.retailPriceCents).toBe(19900)
  })

  it('enforces the platform floor price when a merchant lists the product', async () => {
    await request(app.getHttpServer())
      .post('/api/products/merchant/listings')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ productId, retailPriceCents: 18900 })
      .expect(400)

    const listed = await request(app.getHttpServer())
      .post('/api/products/merchant/listings')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ productId, retailPriceCents: 20900 })
      .expect(201)
    expect(listed.body.retailPriceCents).toBe(20900)

    await request(app.getHttpServer())
      .post('/api/products/merchant/listings')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ productId, retailPriceCents: 20900 })
      .expect(409)
  })

  it('records batches and excludes expired stock from availability', async () => {
    const expired = await request(app.getHttpServer())
      .post(`/api/products/${productId}/batches`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        batchNo: 'B-EXPIRED',
        productionDate: '2025-01-01T00:00:00.000Z',
        expiresAt: '2025-06-01T00:00:00.000Z',
        quantity: 7,
      })
      .expect(201)
    expect(expired.body.remaining).toBe(7)

    const near = await request(app.getHttpServer())
      .post(`/api/products/${productId}/batches`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        batchNo: 'B-NEAR',
        productionDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 5,
      })
      .expect(201)
    batchNearId = near.body.id

    const far = await request(app.getHttpServer())
      .post(`/api/products/${productId}/batches`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        batchNo: 'B-FAR',
        productionDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 10,
      })
      .expect(201)
    batchFarId = far.body.id

    const inventory = await request(app.getHttpServer())
      .get(`/api/products/${productId}/inventory`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(200)
    expect(inventory.body.available).toBe(15)
    expect(inventory.body.expired).toBe(7)
    expect(inventory.body.batches.find((item: { id: string }) => item.id === batchNearId).expired).toBe(
      false,
    )
  })

  it('allocates stock FIFO and refuses when stock is insufficient', async () => {
    const allocations = await request(app.getHttpServer())
      .post(`/api/products/${productId}/allocate`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ quantity: 7 })
      .expect(201)

    expect(allocations.body[0]).toMatchObject({ batchId: batchNearId, quantity: 5 })
    expect(allocations.body[1]).toMatchObject({ batchId: batchFarId, quantity: 2 })

    const inventory = await request(app.getHttpServer())
      .get(`/api/products/${productId}/inventory`)
      .set('Authorization', `Bearer ${supplierToken}`)
      .expect(200)
    expect(inventory.body.available).toBe(8)

    await request(app.getHttpServer())
      .post(`/api/products/${productId}/allocate`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ quantity: 100 })
      .expect(400)
  })
})
