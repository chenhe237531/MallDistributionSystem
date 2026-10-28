import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { AccountStatus } from '@prisma/client'
import { Role } from '@mall/shared'
import { DEFAULT_MERCHANT_MENUS } from '@mall/shared'
import { MerchantMenusService } from './merchant-menus.service'
import type { AuthUser } from '../auth/auth-user.type'
import type { PrismaService } from '../prisma/prisma.service'

/** 商家菜单权限：目录校验 / 已入驻校验 / upsert 保存 / 生效规则（含销售继承） */
describe('MerchantMenusService', () => {
  const actor: AuthUser = {
    sub: 'platform-1',
    phone: '13800000000',
    roles: [Role.PLATFORM],
    role: Role.PLATFORM,
  }

  function buildMerchant(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'merchant-1',
      primaryRole: Role.MERCHANT,
      status: AccountStatus.active,
      organizationId: 'org-1',
      organization: { id: 'org-1', status: AccountStatus.active, type: Role.MERCHANT },
      ...overrides,
    }
  }

  function buildService(userFindUnique: jest.Mock, permissionFindUnique: jest.Mock, upsert: jest.Mock) {
    const prisma = {
      user: {
        findUnique: userFindUnique,
        findFirst: jest.fn(),
      },
      merchantMenuPermission: {
        findUnique: permissionFindUnique,
        upsert,
      },
    } as unknown as PrismaService
    const audit = { record: jest.fn().mockResolvedValue(undefined) }
    return { service: new MerchantMenusService(prisma, audit as never), audit }
  }

  it('getForMerchant 未配置时返回默认全量并标记 isDefault', async () => {
    const { service } = buildService(
      jest.fn().mockResolvedValue(buildMerchant()),
      jest.fn().mockResolvedValue(null),
      jest.fn(),
    )
    const view = await service.getForMerchant('merchant-1')
    expect(view.isDefault).toBe(true)
    expect(view.menus).toEqual([...DEFAULT_MERCHANT_MENUS])
  })

  it('getForMerchant 返回已保存配置', async () => {
    const row = {
      merchantId: 'merchant-1',
      menus: ['procurement', 'prepaid'],
      updatedBy: 'platform-1',
      updatedAt: new Date('2026-10-27T00:00:00Z'),
    }
    const { service } = buildService(
      jest.fn().mockResolvedValue(buildMerchant()),
      jest.fn().mockResolvedValue(row),
      jest.fn(),
    )
    const view = await service.getForMerchant('merchant-1')
    expect(view.isDefault).toBe(false)
    expect(view.menus).toEqual(['procurement', 'prepaid'])
  })

  it('getForMerchant 拒绝非商家账号', async () => {
    const { service } = buildService(
      jest.fn().mockResolvedValue(buildMerchant({ primaryRole: Role.SALES })),
      jest.fn(),
      jest.fn(),
    )
    await expect(service.getForMerchant('merchant-1')).rejects.toThrow(BadRequestException)
  })

  it('getForMerchant 账号不存在时 404', async () => {
    const { service } = buildService(jest.fn().mockResolvedValue(null), jest.fn(), jest.fn())
    await expect(service.getForMerchant('missing')).rejects.toThrow(NotFoundException)
  })

  it('save 拒绝未启用（未入驻）商家', async () => {
    const { service } = buildService(
      jest.fn().mockResolvedValue(buildMerchant({ status: AccountStatus.pending })),
      jest.fn(),
      jest.fn(),
    )
    await expect(service.save('merchant-1', ['procurement'], actor)).rejects.toThrow(
      '仅支持为已启用（已入驻）的商家配置菜单权限',
    )
  })

  it('save 拒绝组织未启用的商家', async () => {
    const { service } = buildService(
      jest.fn().mockResolvedValue(
        buildMerchant({ organization: { id: 'org-1', status: AccountStatus.suspended } }),
      ),
      jest.fn(),
      jest.fn(),
    )
    await expect(service.save('merchant-1', ['procurement'], actor)).rejects.toThrow(
      '商家所属组织未启用，无法配置菜单权限',
    )
  })

  it('save 拒绝目录外的未知菜单 key', async () => {
    const { service } = buildService(
      jest.fn().mockResolvedValue(buildMerchant()),
      jest.fn().mockResolvedValue(null),
      jest.fn(),
    )
    await expect(
      service.save('merchant-1', ['procurement', 'not-exists'], actor),
    ).rejects.toThrow('包含未知菜单项')
  })

  it('save 去重并按目录顺序归一后 upsert，记录审计日志', async () => {
    // 真实库按传入的归一化顺序存储，mock 同样回传 create 里的 menus
    const upsert = jest.fn().mockImplementation(({ create }) =>
      Promise.resolve({
        merchantId: 'merchant-1',
        menus: create.menus,
        updatedBy: create.updatedBy,
        updatedAt: new Date('2026-10-27T00:00:00Z'),
      }),
    )
    const { service, audit } = buildService(
      jest.fn().mockResolvedValue(buildMerchant()),
      jest.fn().mockResolvedValue(null),
      upsert,
    )
    const view = await service.save('merchant-1', ['prepaid', 'procurement', 'prepaid'], actor)
    expect(view.menus).toEqual(['procurement', 'prepaid'])
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { merchantId: 'merchant-1' },
        create: expect.objectContaining({
          merchantId: 'merchant-1',
          updatedBy: 'platform-1',
          menus: ['procurement', 'prepaid'],
        }),
      }),
    )
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'merchant_menu.updated',
        merchantId: 'merchant-1',
        detail: { before: null, after: ['procurement', 'prepaid'] },
      }),
    )
  })

  it('save 允许空数组（关闭全部可选菜单）', async () => {
    const upsert = jest.fn().mockResolvedValue({
      merchantId: 'merchant-1',
      menus: [],
      updatedBy: 'platform-1',
      updatedAt: new Date('2026-10-27T00:00:00Z'),
    })
    const { service } = buildService(
      jest.fn().mockResolvedValue(buildMerchant()),
      jest.fn().mockResolvedValue({ menus: ['procurement'] }),
      upsert,
    )
    const view = await service.save('merchant-1', [], actor)
    expect(view.menus).toEqual([])
  })

  it('resolveForUser 商家主账号读取本人配置', async () => {
    const me: AuthUser = {
      sub: 'merchant-1',
      phone: '13900000001',
      roles: [Role.MERCHANT],
      role: Role.MERCHANT,
    }
    const { service } = buildService(
      jest.fn().mockResolvedValue(buildMerchant()),
      jest.fn().mockResolvedValue({ menus: ['procurement'], updatedAt: new Date() }),
      jest.fn(),
    )
    const result = await service.resolveForUser(me)
    expect(result.menus).toEqual(['procurement'])
  })

  it('resolveForUser 销售继承同组织商家主账号配置', async () => {
    const me: AuthUser = {
      sub: 'sales-1',
      phone: '13900000002',
      roles: [Role.SALES],
      role: Role.SALES,
    }
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sales-1',
          primaryRole: Role.SALES,
          organizationId: 'org-1',
          organization: { id: 'org-1', status: AccountStatus.active },
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 'merchant-1' }),
      },
      merchantMenuPermission: {
        findUnique: jest.fn().mockResolvedValue({ menus: ['training'], updatedAt: new Date() }),
        upsert: jest.fn(),
      },
    } as unknown as PrismaService
    const service = new MerchantMenusService(prisma, { record: jest.fn() } as never)
    const result = await service.resolveForUser(me)
    expect(result.menus).toEqual(['training'])
    expect(prisma.merchantMenuPermission.findUnique).toHaveBeenCalledWith({
      where: { merchantId: 'merchant-1' },
    })
  })

  it('resolveForUser 无配置时回退默认全量', async () => {
    const me: AuthUser = {
      sub: 'merchant-1',
      phone: '13900000001',
      roles: [Role.MERCHANT],
      role: Role.MERCHANT,
    }
    const { service } = buildService(
      jest.fn().mockResolvedValue(buildMerchant()),
      jest.fn().mockResolvedValue(null),
      jest.fn(),
    )
    const result = await service.resolveForUser(me)
    expect(result.menus).toEqual([...DEFAULT_MERCHANT_MENUS])
  })

  it('resolveForUser 拒绝无关角色', async () => {
    const me: AuthUser = {
      sub: 'customer-1',
      phone: '13900000003',
      roles: [Role.CUSTOMER],
      role: Role.CUSTOMER,
    }
    const { service } = buildService(jest.fn(), jest.fn(), jest.fn())
    await expect(service.resolveForUser(me)).rejects.toThrow(ForbiddenException)
  })
})
