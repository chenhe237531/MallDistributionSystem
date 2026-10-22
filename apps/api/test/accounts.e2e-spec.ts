import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)
const merchantPhone = `139${suffix}`
const partnerAPhone = `137${suffix}`
const partnerBPhone = `136${suffix}`
const partnerCPhone = `135${suffix}`
const salesPhone = `134${suffix}`
const customerPhone = `133${suffix}`

describe('Accounts, identity and channel (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let merchantToken: string
  let merchantId: string
  let merchantOrgId: string
  let channelCode: string

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { phone: '13800000000' },
      update: {
        roles: ['platform'],
        primaryRole: 'platform',
        status: 'active',
        passwordHash: await bcrypt.hash('Admin@123', 10),
      },
      create: {
        phone: '13800000000',
        passwordHash: await bcrypt.hash('Admin@123', 10),
        name: '平台管理员',
        roles: ['platform'],
        primaryRole: 'platform',
        status: 'active',
      },
    })

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone: '13800000000', password: 'Admin@123' })
      .expect(201)
    platformToken = login.body.token
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('creates and approves a merchant, generating a channel code', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        phone: merchantPhone,
        password: 'Passw0rd',
        name: '测试商家',
        primaryRole: 'merchant',
        organizationName: '测试商家组织',
      })
      .expect(201)

    expect(created.body.status).toBe('pending')
    merchantId = created.body.id
    merchantOrgId = created.body.organizationId

    const approved = await request(app.getHttpServer())
      .post(`/api/accounts/${merchantId}/approve`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)

    expect(approved.body.status).toBe('active')
    expect(approved.body.channels).toHaveLength(1)
    expect(approved.body.channels[0].type).toBe('merchant')
    expect(approved.body.channels[0].code).toMatch(/^M/)
    channelCode = approved.body.channels[0].code

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone: merchantPhone, password: 'Passw0rd' })
      .expect(201)
    merchantToken = login.body.token

    const channels = await request(app.getHttpServer())
      .get('/api/channels/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(channels.body[0].code).toBe(channelCode)
  })

  it('enforces the two-level partner hierarchy', async () => {
    const createPartner = async (phone: string, name: string) => {
      const created = await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({ phone, password: 'Passw0rd', name, primaryRole: 'partner' })
        .expect(201)
      await request(app.getHttpServer())
        .post(`/api/accounts/${created.body.id}/approve`)
        .set('Authorization', `Bearer ${platformToken}`)
        .expect(201)
      return created.body.id as string
    }

    const partnerA = await createPartner(partnerAPhone, '合伙人 A')
    const partnerB = await createPartner(partnerBPhone, '合伙人 B')
    const partnerC = await createPartner(partnerCPhone, '合伙人 C')

    await request(app.getHttpServer())
      .post(`/api/accounts/partners/${partnerB}/inviter`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ inviterId: partnerA })
      .expect(201)

    await request(app.getHttpServer())
      .post(`/api/accounts/partners/${partnerC}/inviter`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ inviterId: partnerB })
      .expect(400)

    await request(app.getHttpServer())
      .post(`/api/accounts/partners/${partnerA}/inviter`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ inviterId: partnerB })
      .expect(400)

    await request(app.getHttpServer())
      .post(`/api/accounts/partners/${partnerA}/inviter`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ inviterId: partnerA })
      .expect(400)
  })

  it('creates a sales account scoped to the merchant organization', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/accounts/sales')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ phone: salesPhone, password: 'Passw0rd', name: '测试销售' })
      .expect(201)

    expect(created.body.roles).toEqual(['sales'])
    expect(created.body.organizationId).toBe(merchantOrgId)

    await request(app.getHttpServer())
      .post('/api/accounts/sales')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ phone: `132${suffix}`, password: 'Passw0rd', name: '越权销售' })
      .expect(403)
  })

  it('registers a customer and records real-name information', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: customerPhone, password: 'Passw0rd', name: '测试客户' })
      .expect(201)
    const customerToken = registered.body.token

    await request(app.getHttpServer())
      .patch('/api/customers/me/real-name')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ realName: '张三', idCardNo: '110101199003071234', gender: 'male' })
      .expect(200)

    const me = await request(app.getHttpServer())
      .get('/api/customers/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    expect(me.body.realName).toBe('张三')
    expect(me.body.idCardNo).toBe('110101199003071234')
  })

  it('creates a qualification expiry reminder within 30 days', async () => {
    const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    const qualification = await request(app.getHttpServer())
      .post(`/api/accounts/${merchantId}/qualifications`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ type: 'business_license', expiresAt })
      .expect(201)

    expect(qualification.body.status).toBe('pending')

    const reminders = await request(app.getHttpServer())
      .get('/api/reminders')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(
      reminders.body.some(
        (item: { type: string; subjectId: string }) =>
          item.type === 'qualification_expiry' && item.subjectId === merchantId,
      ),
    ).toBe(true)
  })

  it('suspends the merchant, invalidating the channel identity', async () => {
    await request(app.getHttpServer())
      .post(`/api/accounts/${merchantId}/suspend`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)

    const channels = await request(app.getHttpServer())
      .get('/api/channels/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(channels.body[0].status).toBe('inactive')

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone: merchantPhone, password: 'Passw0rd' })
      .expect(403)

    const resolved = await request(app.getHttpServer())
      .get(`/api/channels/resolve/${channelCode}`)
      .expect(200)
    expect(resolved.body.valid).toBe(false)
  })
})
