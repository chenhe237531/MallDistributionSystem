import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import request from 'supertest'
import { AppModule } from '../src/app.module'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)
const platformPhone = '13800000000'
const merchantPhone = `132${suffix}`
const salesPhone = `131${suffix}`

/** 商家菜单权限（e2e）：后台查询/保存校验、审计留痕、商家端 me 生效与销售继承 */
describe('Merchant menu permissions (e2e)', () => {
  let app: INestApplication
  let platformToken: string
  let merchantToken: string
  let salesToken: string
  let merchantId: string
  let merchantOrgId: string

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { phone: platformPhone },
      update: {
        roles: ['platform'],
        primaryRole: 'platform',
        status: 'active',
        passwordHash: await bcrypt.hash('Admin@123', 10),
      },
      create: {
        phone: platformPhone,
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

    platformToken = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: platformPhone, password: 'Admin@123' })
        .expect(201)
    ).body.token

    // 建商家 + 审核（入驻完成）
    merchantId = (
      await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({
          phone: merchantPhone,
          password: 'Passw0rd',
          name: '菜单权限商家',
          primaryRole: 'merchant',
          organizationName: '菜单权限商家组织',
        })
        .expect(201)
    ).body.id
    merchantOrgId = (
      await request(app.getHttpServer())
        .get('/api/accounts')
        .set('Authorization', `Bearer ${platformToken}`)
        .expect(200)
    ).body.find((user: { id: string }) => user.id === merchantId).organizationId
    await request(app.getHttpServer())
      .post(`/api/accounts/${merchantId}/approve`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(201)

    merchantToken = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: merchantPhone, password: 'Passw0rd' })
        .expect(201)
    ).body.token

    // 同组织销售账号（商家创建）
    await request(app.getHttpServer())
      .post('/api/accounts/sales')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ phone: salesPhone, password: 'Passw0rd', name: '菜单销售' })
      .expect(201)
    await prisma.user.update({
      where: { phone: salesPhone },
      data: { status: 'active', organizationId: merchantOrgId },
    })
    salesToken = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: salesPhone, password: 'Passw0rd' })
        .expect(201)
    ).body.token
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('未配置时商家端与后台都拿到默认全量', async () => {
    const mine = await request(app.getHttpServer())
      .get('/api/merchant-menus/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(mine.body.menus).toContain('procurement')
    expect(mine.body.menus).toContain('claims')

    const view = await request(app.getHttpServer())
      .get(`/api/merchant-menus/${merchantId}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200)
    expect(view.body.isDefault).toBe(true)
    expect(view.body.menus).toContain('procurement')
  })

  it('后台保存后商家端拿到所选菜单，销售继承组织配置', async () => {
    await request(app.getHttpServer())
      .put(`/api/merchant-menus/${merchantId}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ menus: ['procurement', 'prepaid', 'prepaid', 'unknown-key'] })
      .expect(400)

    const saved = await request(app.getHttpServer())
      .put(`/api/merchant-menus/${merchantId}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ menus: ['prepaid', 'procurement', 'prepaid'] })
      .expect(200)
    expect(saved.body.menus).toEqual(['procurement', 'prepaid'])
    expect(saved.body.isDefault).toBe(false)

    const merchantMenus = await request(app.getHttpServer())
      .get('/api/merchant-menus/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(merchantMenus.body.menus).toEqual(['procurement', 'prepaid'])

    const salesMenus = await request(app.getHttpServer())
      .get('/api/merchant-menus/me')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200)
    expect(salesMenus.body.menus).toEqual(['procurement', 'prepaid'])

    // 审计留痕
    const logs = await prisma.auditLog.findMany({
      where: { action: 'merchant_menu.updated', merchantId },
    })
    expect(logs).toHaveLength(1)
    expect(logs[0].detail).toMatchObject({ before: null, after: ['procurement', 'prepaid'] })
  })

  it('空数组允许保存并即时生效；非平台角色不能改配置', async () => {
    await request(app.getHttpServer())
      .put(`/api/merchant-menus/${merchantId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ menus: ['procurement'] })
      .expect(403)

    const saved = await request(app.getHttpServer())
      .put(`/api/merchant-menus/${merchantId}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ menus: [] })
      .expect(200)
    expect(saved.body.menus).toEqual([])

    const merchantMenus = await request(app.getHttpServer())
      .get('/api/merchant-menus/me')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(merchantMenus.body.menus).toEqual([])
  })

  it('未入驻（待审核）商家不可配置', async () => {
    const pendingId = (
      await request(app.getHttpServer())
        .post('/api/accounts')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({
          phone: `130${suffix}`,
          password: 'Passw0rd',
          name: '待入驻商家',
          primaryRole: 'merchant',
          organizationName: '待入驻组织',
        })
        .expect(201)
    ).body.id
    await request(app.getHttpServer())
      .put(`/api/merchant-menus/${pendingId}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ menus: ['procurement'] })
      .expect(400)
  })
})
