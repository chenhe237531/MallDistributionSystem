import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

type Template = { id: string; code: string; version: number }

describe('Contracts, e-sign and offline agreements (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let merchantToken: string
  let merchantId: string
  let merchantContractId: string
  let supplierId: string
  let merchantTemplate: Template
  let supplierTemplate: Template
  let partnerTemplate: Template

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
      .send({
        phone,
        password: 'Passw0rd',
        name,
        primaryRole: role,
        organizationName,
      })
      .expect(201)
    await request(app.getHttpServer())
      .post(`/api/accounts/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)
    return created.body.id as string
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()

    platformToken = await login('13800000000', 'Admin@123')
    await request(app.getHttpServer())
      .patch('/api/contracts/settings/provider')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ provider: 'esignbao' })
      .expect(200)

    const templates = await request(app.getHttpServer())
      .get('/api/contracts/templates')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    const list = templates.body as Template[]
    merchantTemplate = list.find(
      (item) => item.code === 'merchant_onboarding' && item.version === 1,
    ) as Template
    supplierTemplate = list.find(
      (item) => item.code === 'supplier_supply' && item.version === 1,
    ) as Template
    partnerTemplate = list.find(
      (item) => item.code === 'partner_distribution' && item.version === 1,
    ) as Template

    merchantId = await createAccount(
      'merchant',
      `150${suffix}`,
      '合同测试商家',
      '合同测试商家组织',
    )
    supplierId = await createAccount(
      'supplier',
      `151${suffix}`,
      '合同测试供应商',
      '合同测试供应商组织',
    )
    merchantToken = await login(`150${suffix}`, 'Passw0rd')
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('blocks merchant listing before the e-sign contract is active', async () => {
    const eligibility = await request(app.getHttpServer())
      .get('/api/contracts/eligibility/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(eligibility.body.canList).toBe(false)
    expect(eligibility.body.reasons.length).toBeGreaterThan(0)
  })

  it('runs the e-sign flow from draft to active and unlocks merchant listing', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/contracts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ templateId: merchantTemplate.id, subjectUserId: merchantId, expiresAt: '2027-12-31T00:00:00.000Z' })
      .expect(201)
    expect(created.body.status).toBe('draft')
    expect(created.body.templateVersion).toBe(1)
    merchantContractId = created.body.id

    const initiated = await request(app.getHttpServer())
      .post(`/api/contracts/${merchantContractId}/initiate`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({})
      .expect(201)
    expect(initiated.body.status).toBe('pending_sign')
    expect(initiated.body.tasks).toHaveLength(1)
    expect(initiated.body.tasks[0].provider).toBe('esignbao')
    expect(initiated.body.tasks[0].signUrl).toContain('mock-esign.local')

    const signed = await request(app.getHttpServer())
      .post(`/api/contracts/${merchantContractId}/mock-sign`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(201)
    expect(signed.body.status).toBe('active')
    expect(signed.body.evidenceNo).toContain('MOCK-')
    expect(signed.body.fileHash).toHaveLength(64)

    const eligibility = await request(app.getHttpServer())
      .get('/api/contracts/eligibility/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(eligibility.body.canList).toBe(true)
  })

  it('switches e-sign provider only for new tasks', async () => {
    const switched = await request(app.getHttpServer())
      .patch('/api/contracts/settings/provider')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ provider: 'tencent' })
      .expect(200)
    expect(switched.body.provider).toBe('tencent')

    const created = await request(app.getHttpServer())
      .post('/api/contracts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ templateId: supplierTemplate.id, subjectUserId: supplierId })
      .expect(201)
    const initiated = await request(app.getHttpServer())
      .post(`/api/contracts/${created.body.id}/initiate`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(initiated.body.tasks[0].provider).toBe('tencent')

    const oldContract = await request(app.getHttpServer())
      .get(`/api/contracts/${merchantContractId}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(oldContract.body.tasks[0].provider).toBe('esignbao')
  })

  it('keeps template versions immutable for existing contracts', async () => {
    const versionCode = `version_test_${suffix}`
    await request(app.getHttpServer())
      .post('/api/contracts/templates')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        code: versionCode,
        name: '版本测试模板（第一版）',
        version: 1,
        partyType: 'merchant',
        body: '第一版条款',
        lockedClauses: ['报告使用范围'],
      })
      .expect(201)
    await request(app.getHttpServer())
      .post('/api/contracts/templates')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        code: versionCode,
        name: '版本测试模板（第二版）',
        version: 2,
        partyType: 'merchant',
        body: '第二版条款',
        lockedClauses: ['报告使用范围'],
      })
      .expect(201)

    const templates = await request(app.getHttpServer())
      .get('/api/contracts/templates')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    const versionTwo = (templates.body as Template[]).find(
      (item) => item.code === versionCode && item.version === 2,
    )
    expect(versionTwo).toBeDefined()

    const created = await request(app.getHttpServer())
      .post('/api/contracts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ templateId: versionTwo?.id, subjectUserId: merchantId })
      .expect(201)
    expect(created.body.templateVersion).toBe(2)

    const oldContract = await request(app.getHttpServer())
      .get(`/api/contracts/${merchantContractId}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(oldContract.body.templateVersion).toBe(1)
  })

  it('registers an offline agreement for a partner', async () => {
    const partnerId = await createAccount('partner', `152${suffix}`, '合同测试合伙人')
    const validFrom = new Date().toISOString()
    const validTo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

    const registered = await request(app.getHttpServer())
      .post('/api/contracts/offline')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        templateId: partnerTemplate.id,
        subjectUserId: partnerId,
        contractNo: `OFFLINE-${suffix}`,
        validFrom,
        validTo,
        scanFileUrl: 'local://scans/partner-agreement.pdf',
      })
      .expect(201)
    expect(registered.body.status).toBe('active')
    expect(registered.body.signMode).toBe('offline')
    expect(registered.body.offline.registeredBy).toBeTruthy()

    await request(app.getHttpServer())
      .post('/api/contracts/offline')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        templateId: merchantTemplate.id,
        subjectUserId: merchantId,
        validFrom,
      })
      .expect(400)
  })

  it('terminates the contract and invalidates the channel identity', async () => {
    const terminated = await request(app.getHttpServer())
      .post(`/api/contracts/${merchantContractId}/terminate`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)
    expect(terminated.body.status).toBe('terminated')

    const channels = await request(app.getHttpServer())
      .get('/api/channels/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(channels.body[0].status).toBe('inactive')
  })
})
