import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { chineseValidationExceptionFactory } from '../src/common/validation'

const prisma = new PrismaClient()
const suffix = String(Date.now()).slice(-8)

type Address = {
  id: string
  receiverName: string
  receiverPhone: string
  region: string
  detail: string
  isDefault: boolean
}

describe('Customer shipping addresses (e2e)', () => {
  let app: INestApplication
  let customerToken: string
  let otherToken: string
  let firstId: string
  let secondId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    // 与 main.ts 保持一致的全局管道，校验文案断言才有意义
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: chineseValidationExceptionFactory,
      }),
    )
    await app.init()

    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: `139${suffix}`, password: 'Passw0rd', name: '地址测试客户' })
      .expect(201)
    customerToken = registered.body.token

    const otherRegistered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: `138${suffix}`, password: 'Passw0rd', name: '地址测试客户乙' })
      .expect(201)
    otherToken = otherRegistered.body.token
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  const payload = {
    receiverName: '王小明',
    receiverPhone: '13812345678',
    region: '上海市浦东新区',
    detail: '张江路 100 号 3 号楼 501',
  }

  it('rejects an invalid address with Chinese messages', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/customers/me/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ receiverName: '', receiverPhone: '123', detail: 'x' })
      .expect(400)
    const messages = response.body.message as string[]
    expect(Array.isArray(messages)).toBe(true)
    expect(messages).toContain('请填写收货人姓名')
    expect(messages).toContain('请输入 11 位收货人手机号')
    expect(messages).toContain('请填写详细地址')
    // 全部文案均为中文，不允许出现 class-validator 英文默认文案
    for (const message of messages) {
      expect(/[\u4e00-\u9fff]/.test(message)).toBe(true)
    }
  })

  it('rejects an order with missing contact fields in Chinese', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [], contactName: '', contactPhone: '123' })
      .expect(400)
    const messages = response.body.message as string[]
    expect(messages).toContain('请至少选择一件商品')
    expect(messages).toContain('请填写联系人姓名')
    expect(messages).toContain('请输入 11 位联系人手机号')
  })

  it('creates the first address and marks it default automatically', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/customers/me/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(payload)
      .expect(201)
    firstId = response.body.id
    expect(response.body).toMatchObject({
      receiverName: '王小明',
      receiverPhone: '13812345678',
      region: '上海市浦东新区',
      detail: '张江路 100 号 3 号楼 501',
      isDefault: true,
    })
  })

  it('creates a second non-default address and switches default on demand', async () => {
    const second = await request(app.getHttpServer())
      .post('/api/customers/me/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        receiverName: '李小红',
        receiverPhone: '13987654321',
        detail: '南京西路 8 弄 2 号 101',
        isDefault: true,
      })
      .expect(201)
    secondId = second.body.id
    expect(second.body.isDefault).toBe(true)

    // 默认地址唯一：第一条被挤掉默认
    const list = await request(app.getHttpServer())
      .get('/api/customers/me/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    const addresses = list.body as Address[]
    expect(addresses).toHaveLength(2)
    expect(addresses.filter((item) => item.isDefault)).toHaveLength(1)
    expect(addresses.find((item) => item.isDefault)?.id).toBe(secondId)
    // 默认地址置顶
    expect(addresses[0].id).toBe(secondId)
  })

  it('updates an address without touching default flags', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/customers/me/addresses/${firstId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ ...payload, receiverName: '王小明', detail: '张江路 200 号 5 号楼 302' })
      .expect(200)
    expect(updated.body.detail).toBe('张江路 200 号 5 号楼 302')
    expect(updated.body.isDefault).toBe(false)
  })

  it('hides addresses from other customers', async () => {
    await request(app.getHttpServer())
      .patch(`/api/customers/me/addresses/${firstId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send(payload)
      .expect(404)
    await request(app.getHttpServer())
      .delete(`/api/customers/me/addresses/${firstId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404)
  })

  it('promotes the latest address to default after deleting the default one', async () => {
    await request(app.getHttpServer())
      .delete(`/api/customers/me/addresses/${secondId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)

    const list = await request(app.getHttpServer())
      .get('/api/customers/me/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
    const addresses = list.body as Address[]
    expect(addresses).toHaveLength(1)
    expect(addresses[0].id).toBe(firstId)
    expect(addresses[0].isDefault).toBe(true)
  })
})
