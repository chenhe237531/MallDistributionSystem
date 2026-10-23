import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

type Template = { id: string; code: string; name: string }

describe('Materials and templates (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let supplierToken: string
  let merchantToken: string
  let supplierId: string
  let merchantId: string
  let productId: string
  let materialId: string

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
    supplierId = await createAccount('supplier', `240${suffix}`, '素材测试供应商')
    merchantId = await createAccount('merchant', `241${suffix}`, '素材测试商家')
    supplierToken = await login(`240${suffix}`, 'Passw0rd')
    merchantToken = await login(`241${suffix}`, 'Passw0rd')

    const templatesResponse = await request(app.getHttpServer())
      .get('/api/contracts/templates')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    const contractTemplates = templatesResponse.body as Array<{
      id: string
      code: string
      version: number
    }>
    await activateContract(
      contractTemplates.find(
        (item) => item.code === 'supplier_supply' && item.version === 1,
      )!.id,
      supplierId,
      supplierToken,
    )
    await activateContract(
      contractTemplates.find(
        (item) => item.code === 'merchant_onboarding' && item.version === 1,
      )!.id,
      merchantId,
      merchantToken,
    )

    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${supplierToken}`)
      .send({
        skuCode: `MAT-${suffix}`,
        name: '素材测试检测盒',
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
      .post('/api/products/merchant/listings')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ productId, retailPriceCents: 21900 })
      .expect(201)
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('generates a material with store info, channel code and locked clauses', async () => {
    const templates = await request(app.getHttpServer())
      .get('/api/materials/templates')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    const template = (templates.body as Template[]).find(
      (item) => item.code === 'moments_copy',
    ) as Template

    const generated = await request(app.getHttpServer())
      .post('/api/materials/generate')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        templateId: template.id,
        productId,
        storeName: '素材测试门店',
        storeAddress: '杭州市测试路 1 号',
        note: '欢迎到店体验',
      })
      .expect(201)
    materialId = generated.body.id
    expect(generated.body.content).toContain('素材测试门店')
    expect(generated.body.content).toContain('素材测试商家组织')
    expect(generated.body.content).toContain(generated.body.channelCode)
    expect(generated.body.content).toContain('平台锁定条款')
    expect(generated.body.content).toContain('不作为临床诊断依据')
    expect(generated.body.qrPayload).toContain(generated.body.channelCode)
  })

  it('blocks prohibited wording and names the offending term', async () => {
    const templates = await request(app.getHttpServer())
      .get('/api/materials/templates')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    const template = (templates.body as Template[]).find(
      (item) => item.code === 'moments_copy',
    ) as Template

    const response = await request(app.getHttpServer())
      .post('/api/materials/generate')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        templateId: template.id,
        productId,
        note: '保证治愈所有症状',
      })
      .expect(400)
    expect(response.body.message).toContain('治愈')
  })

  it('enforces template product scope and active status', async () => {
    const scoped = await request(app.getHttpServer())
      .post('/api/materials/templates')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        code: `scoped-${suffix}`,
        name: '限定商品模板',
        category: 'poster',
        contentType: 'text',
        body: '限定商品素材',
        applicableProductIds: ['not-this-product'],
      })
      .expect(201)

    await request(app.getHttpServer())
      .post('/api/materials/generate')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ templateId: scoped.body.id, productId })
      .expect(400)

    const inactive = await request(app.getHttpServer())
      .post('/api/materials/templates')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        code: `inactive-${suffix}`,
        name: '待下架模板',
        category: 'poster',
        contentType: 'text',
        body: '模板内容',
      })
      .expect(201)
    await request(app.getHttpServer())
      .patch(`/api/materials/templates/${inactive.body.id}/status`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ active: false })
      .expect(200)

    await request(app.getHttpServer())
      .post('/api/materials/generate')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ templateId: inactive.body.id })
      .expect(400)

    await request(app.getHttpServer())
      .get('/api/materials/templates?includeInactive=true')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
      .then((response) => {
        expect(
          response.body.some((item: Template) => item.id === inactive.body.id),
        ).toBe(true)
      })
  })

  it('records usage, allows download, and blocks merchant template editing', async () => {
    const mine = await request(app.getHttpServer())
      .get('/api/materials/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(mine.body.some((item: { id: string }) => item.id === materialId)).toBe(true)
    expect(mine.body[0].generatedBy).toBe(merchantId)

    const download = await request(app.getHttpServer())
      .get(`/api/materials/${materialId}/download`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(download.headers['content-type']).toContain('text/plain')
    expect(download.text).toContain('素材测试门店')

    await request(app.getHttpServer())
      .post('/api/materials/templates')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        code: `merchant-template-${suffix}`,
        name: '商家自建模板',
        category: 'poster',
        contentType: 'text',
        body: '内容',
      })
      .expect(403)
  })
})
