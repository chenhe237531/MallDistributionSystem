import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

describe('Prepaid account and recharge (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let merchantToken: string
  let merchantId: string
  let accountId: string
  const voucherUrl = `local://vouchers/${suffix}.jpg`
  let creditedRechargeId: string

  const login = async (phone: string, password: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone, password })
      .expect(201)
    return response.body.token as string
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()

    platformToken = await login('13800000000', 'Admin@123')

    const created = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        phone: `170${suffix}`,
        password: 'Passw0rd',
        name: '预付款测试商家',
        primaryRole: 'merchant',
        organizationName: `预付款测试商家组织${suffix}`,
      })
      .expect(201)
    merchantId = created.body.id
    await request(app.getHttpServer())
      .post(`/api/accounts/${merchantId}/approve`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)
    merchantToken = await login(`170${suffix}`, 'Passw0rd')
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('starts with an empty account and records a recharge request', async () => {
    const me = await request(app.getHttpServer())
      .get('/api/prepaid/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(me.body.account.availableCents).toBe(0)
    expect(me.body.account.status).toBe('active')
    accountId = me.body.account.id

    const recharge = await request(app.getHttpServer())
      .post('/api/prepaid/recharges')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        amountCents: 100000,
        paidAmountCents: 100000,
        payerName: `预付款测试商家组织${suffix}`,
        voucherUrl,
      })
      .expect(201)
    expect(recharge.body.status).toBe('pending')
    creditedRechargeId = recharge.body.id

    await request(app.getHttpServer())
      .post('/api/prepaid/recharges')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ amountCents: 100000, voucherUrl })
      .expect(409)
  })

  it('credits the recharge once and creates a ledger entry', async () => {
    const credited = await request(app.getHttpServer())
      .post(`/api/prepaid/recharges/${creditedRechargeId}/credit`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(201)
    expect(credited.body.order.status).toBe('credited')
    expect(credited.body.account.availableCents).toBe(100000)
    expect(credited.body.account.totalRechargeCents).toBe(100000)

    await request(app.getHttpServer())
      .post(`/api/prepaid/recharges/${creditedRechargeId}/credit`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(409)

    const me = await request(app.getHttpServer())
      .get('/api/prepaid/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(me.body.integrity.ok).toBe(true)
    expect(me.body.entries[0].type).toBe('recharge')
    expect(me.body.entries[0].balanceAfterCents).toBe(100000)
  })

  it('routes a mismatched voucher to manual review before crediting', async () => {
    const recharge = await request(app.getHttpServer())
      .post('/api/prepaid/recharges')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        amountCents: 10000,
        paidAmountCents: 9000,
        voucherUrl: `local://vouchers/${suffix}-mismatch.jpg`,
      })
      .expect(201)
    expect(recharge.body.status).toBe('pending_review')
    expect(recharge.body.note).toContain('不一致')

    await request(app.getHttpServer())
      .post(`/api/prepaid/recharges/${recharge.body.id}/credit`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({})
      .expect(400)

    await request(app.getHttpServer())
      .post(`/api/prepaid/recharges/${recharge.body.id}/credit`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reviewApproved: true })
      .expect(201)
  })

  it('records platform adjustments and prevents a negative balance', async () => {
    await request(app.getHttpServer())
      .post('/api/prepaid/adjust')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ merchantId, amountCents: -10000, note: '线下退款调整' })
      .expect(201)

    const me = await request(app.getHttpServer())
      .get('/api/prepaid/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(me.body.account.availableCents).toBe(100000)
    expect(me.body.account.adjustmentCents).toBe(-10000)
    expect(me.body.entries.some((entry: { type: string }) => entry.type === 'adjust')).toBe(true)

    await request(app.getHttpServer())
      .post('/api/prepaid/adjust')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ merchantId, amountCents: -999999, note: '超额调整' })
      .expect(400)
  })

  it('locks the account and raises an alert when balances and ledger diverge', async () => {
    await prisma.prepaidAccount.update({
      where: { id: accountId },
      data: { availableCents: { increment: 1 } },
    })

    const me = await request(app.getHttpServer())
      .get('/api/prepaid/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(me.body.integrity.ok).toBe(false)
    expect(me.body.integrity.locked).toBe(true)
    expect(me.body.account.status).toBe('locked')

    const alerts = await prisma.systemAlert.findMany({
      where: { type: 'prepaid_imbalance', subjectId: accountId, status: 'open' },
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].severity).toBe('critical')

    await request(app.getHttpServer())
      .post('/api/prepaid/unlock')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ merchantId })
      .expect(201)
  })
})
