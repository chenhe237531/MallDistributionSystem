import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  Contract,
  ContractStatus as PrismaContractStatus,
  ContractTemplate,
  ESignTask,
  OfflineAgreement,
  Role as PrismaRole,
  SignMode as PrismaSignMode,
} from '@prisma/client'
import { createHash, randomBytes } from 'node:crypto'
import { Role } from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateContractDto } from './dto/create-contract.dto'
import { CreateTemplateDto } from './dto/create-template.dto'
import { InitiateContractDto } from './dto/initiate-contract.dto'
import { RegisterOfflineDto } from './dto/register-offline.dto'
import { ESignService } from './esign.service'
import type { AuthUser } from '../auth/auth-user.type'

export const CONTRACT_CODES = {
  MERCHANT_ONBOARDING: 'merchant_onboarding',
  SUPPLIER_SUPPLY: 'supplier_supply',
  PARTNER_DISTRIBUTION: 'partner_distribution',
  NUTRITIONIST_SERVICE: 'nutritionist_service',
  CUSTOMER_DETECTION: 'customer_detection',
} as const

const EXPIRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const OFFLINE_PARTY_TYPES: PrismaRole[] = ['partner', 'nutritionist']

type ContractWithRelations = Contract & {
  template: ContractTemplate
  tasks: ESignTask[]
  offline: OfflineAgreement | null
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly esignService: ESignService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createTemplate(dto: CreateTemplateDto) {
    const partyType = dto.partyType as unknown as PrismaRole
    const existing = await this.prisma.contractTemplate.findUnique({
      where: { code_version: { code: dto.code, version: dto.version } },
    })
    if (existing) {
      throw new ConflictException('该模板版本已存在')
    }
    return this.prisma.contractTemplate.create({
      data: {
        code: dto.code,
        name: dto.name,
        version: dto.version,
        partyType,
        body: dto.body,
        lockedClauses: dto.lockedClauses ?? [],
      },
    })
  }

  async listTemplates() {
    return this.prisma.contractTemplate.findMany({
      where: { active: true },
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
    })
  }

  async createContract(dto: CreateContractDto) {
    const template = await this.prisma.contractTemplate.findUnique({ where: { id: dto.templateId } })
    if (!template || !template.active) {
      throw new NotFoundException('合同模板不存在或已停用')
    }
    const subject = await this.prisma.user.findUnique({ where: { id: dto.subjectUserId } })
    if (!subject) {
      throw new NotFoundException('签署主体不存在')
    }
    if (!subject.roles.includes(template.partyType)) {
      throw new BadRequestException('签署主体不具备该合同所需角色')
    }

    const contract = await this.prisma.contract.create({
      data: {
        contractNo: await this.generateContractNo(),
        templateId: template.id,
        templateVersion: template.version,
        subjectUserId: subject.id,
        subjectType: template.partyType,
        status: PrismaContractStatus.draft,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: { template: true, tasks: true, offline: true },
    })
    await this.auditService.record({
      action: 'contract.create',
      resourceType: 'contract',
      resourceId: contract.id,
      merchantId: contract.subjectType === 'merchant' ? contract.subjectUserId : null,
      detail: { contractNo: contract.contractNo, templateCode: template.code, version: contract.templateVersion },
    })
    return contract
  }

  async list(actor: AuthUser) {
    const isPlatform = actor.roles.includes(Role.PLATFORM)
    return this.prisma.contract.findMany({
      where: isPlatform ? {} : { subjectUserId: actor.sub },
      include: { template: true, tasks: true, offline: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async mine(actor: AuthUser) {
    return this.prisma.contract.findMany({
      where: { subjectUserId: actor.sub },
      include: { template: true, tasks: true, offline: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { template: true, tasks: true, offline: true },
    })
    if (!contract) {
      throw new NotFoundException('合同不存在')
    }
    return contract
  }

  /**
   * 对外（HTTP）查询合同详情：合同含模板正文与签署链接，
   * 仅允许合同主体本人或平台查看，防止任意登录用户枚举他人合同。
   */
  async getOneForActor(id: string, actor: AuthUser) {
    const contract = await this.getOne(id)
    this.assertSubjectOrPlatform(contract, actor)
    return contract
  }

  async initiate(id: string, dto: InitiateContractDto, actor: AuthUser) {
    const contract = await this.getOne(id)
    this.assertSubjectOrPlatform(contract, actor)

    if (
      contract.status !== PrismaContractStatus.draft &&
      contract.status !== PrismaContractStatus.pending_renewal
    ) {
      throw new BadRequestException('当前合同状态不能发起签署')
    }

    const provider = dto.provider ?? (await this.esignService.getProvider())
    const task = await this.esignService.createTask(provider, contract.contractNo)

    await this.prisma.$transaction([
      this.prisma.eSignTask.create({
        data: {
          contractId: id,
          provider,
          externalId: task.externalId,
          signUrl: task.signUrl,
        },
      }),
      this.prisma.contract.update({
        where: { id },
        data: {
          status: PrismaContractStatus.pending_sign,
          signMode: provider as unknown as PrismaSignMode,
          provider,
        },
      }),
    ])

    await this.auditService.record({
      actor,
      action: 'contract.initiate',
      resourceType: 'contract',
      resourceId: contract.id,
      merchantId: contract.subjectType === 'merchant' ? contract.subjectUserId : null,
      detail: { contractNo: contract.contractNo, provider },
    })
    return this.getOne(id)
  }

  async mockSign(id: string, actor: AuthUser) {
    const contract = await this.getOne(id)
    this.assertSubjectOrPlatform(contract, actor)
    if (contract.status !== PrismaContractStatus.pending_sign) {
      throw new BadRequestException('合同不在待签署状态')
    }
    const pendingTask = contract.tasks.find((task) => task.status === 'pending')
    if (!pendingTask) {
      throw new BadRequestException('没有待完成的签署任务')
    }

    await this.prisma.$transaction([
      this.prisma.eSignTask.update({
        where: { id: pendingTask.id },
        data: { status: 'completed', completedAt: new Date() },
      }),
      this.prisma.contract.update({
        where: { id },
        data: {
          status: PrismaContractStatus.active,
          effectiveAt: new Date(),
          evidenceNo: `MOCK-${pendingTask.externalId}`,
          fileHash: createHash('sha256').update(`${contract.contractNo}:${contract.templateVersion}`).digest('hex'),
        },
      }),
    ])

    await this.createExpiryReminder(contract)
    await this.auditService.record({
      actor,
      action: 'contract.sign',
      resourceType: 'contract',
      resourceId: contract.id,
      merchantId: contract.subjectType === 'merchant' ? contract.subjectUserId : null,
      detail: { contractNo: contract.contractNo, provider: contract.signMode },
    })
    await this.notificationsService.emit({
      type: 'contract_active',
      recipientId: contract.subjectUserId,
      recipientRole: contract.subjectType as unknown as Role,
      subjectType: 'contract',
      subjectId: contract.id,
      title: '合同已生效',
      body: `合同 ${contract.contractNo} 已完成签署并生效。`,
      templateCode: 'contract_active',
      dedupeKey: `contract_active:${contract.id}`,
      payload: { contractId: contract.id, contractNo: contract.contractNo },
    })
    return this.getOne(id)
  }

  async terminate(id: string) {
    const contract = await this.getOne(id)
    if (contract.status === PrismaContractStatus.terminated) {
      return contract
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id },
        data: { status: PrismaContractStatus.terminated, terminatedAt: new Date() },
      })
      await tx.channelIdentity.updateMany({
        where: { userId: contract.subjectUserId },
        data: { status: 'inactive' },
      })
    })
    await this.auditService.record({
      action: 'contract.terminate',
      resourceType: 'contract',
      resourceId: contract.id,
      merchantId: contract.subjectType === 'merchant' ? contract.subjectUserId : null,
      detail: { contractNo: contract.contractNo },
    })
    return this.getOne(id)
  }

  async registerOffline(dto: RegisterOfflineDto, actor: AuthUser) {
    const template = await this.prisma.contractTemplate.findUnique({ where: { id: dto.templateId } })
    if (!template || !template.active) {
      throw new NotFoundException('合同模板不存在或已停用')
    }
    if (!OFFLINE_PARTY_TYPES.includes(template.partyType)) {
      throw new BadRequestException('该合同类型必须走电子签')
    }
    const subject = await this.prisma.user.findUnique({ where: { id: dto.subjectUserId } })
    if (!subject || !subject.roles.includes(template.partyType)) {
      throw new BadRequestException('签署主体不存在或角色不匹配')
    }

    const contractNo = dto.contractNo ?? (await this.generateContractNo())
    const duplicate = await this.prisma.contract.findUnique({ where: { contractNo } })
    if (duplicate) {
      throw new ConflictException('合同编号已存在')
    }

    const validFrom = new Date(dto.validFrom)
    const validTo = dto.validTo ? new Date(dto.validTo) : null
    if (validTo && validTo <= validFrom) {
      throw new BadRequestException('有效期结束时间必须晚于开始时间')
    }

    const contract = await this.prisma.contract.create({
      data: {
        contractNo,
        templateId: template.id,
        templateVersion: template.version,
        subjectUserId: subject.id,
        subjectType: template.partyType,
        status: PrismaContractStatus.active,
        signMode: PrismaSignMode.offline,
        provider: 'offline',
        effectiveAt: validFrom,
        expiresAt: validTo,
        offline: {
          create: {
            scanFileUrl: dto.scanFileUrl,
            registeredBy: actor.sub,
            validFrom,
            validTo,
          },
        },
      },
      include: { template: true, tasks: true, offline: true },
    })

    await this.createExpiryReminder(contract)
    await this.auditService.record({
      actor,
      action: 'contract.offline_register',
      resourceType: 'contract',
      resourceId: contract.id,
      merchantId: contract.subjectType === 'merchant' ? contract.subjectUserId : null,
      detail: { contractNo: contract.contractNo, scanFileUrl: dto.scanFileUrl },
    })
    return contract
  }

  async eligibility(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException('账号不存在')
    }

    const reasons: string[] = []
    let canList = false
    let canSupply = false

    if (user.roles.includes(PrismaRole.merchant)) {
      const contract = await this.findActiveContract(userId, CONTRACT_CODES.MERCHANT_ONBOARDING)
      canList = Boolean(contract)
      if (!contract) {
        reasons.push('未完成入驻与供货合作协议，暂不能上架')
      }
    }
    if (user.roles.includes(PrismaRole.supplier)) {
      const contract = await this.findActiveContract(userId, CONTRACT_CODES.SUPPLIER_SUPPLY)
      canSupply = Boolean(contract)
      if (!contract) {
        reasons.push('未完成供货协议，暂不能供货')
      }
    }

    return { canList, canSupply, reasons }
  }

  async assertMerchantCanList(userId: string): Promise<void> {
    const result = await this.eligibility(userId)
    if (!result.canList) {
      throw new ForbiddenException('未完成入驻与供货合作协议，不能上架商品')
    }
  }

  async assertSupplierCanSupply(userId: string): Promise<void> {
    const result = await this.eligibility(userId)
    if (!result.canSupply) {
      throw new ForbiddenException('未完成供货协议，不能供货')
    }
  }

  getProvider() {
    return this.esignService.getProvider()
  }

  setProvider(provider: 'esignbao' | 'tencent') {
    return this.esignService.setProvider(provider)
  }

  private async findActiveContract(userId: string, templateCode: string) {
    const now = new Date()
    return this.prisma.contract.findFirst({
      where: {
        subjectUserId: userId,
        status: PrismaContractStatus.active,
        template: { code: templateCode },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    })
  }

  private assertSubjectOrPlatform(contract: Contract, actor: AuthUser): void {
    if (contract.subjectUserId !== actor.sub && !actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('无权操作该合同')
    }
  }

  private async createExpiryReminder(contract: Contract): Promise<void> {
    if (!contract.expiresAt) {
      return
    }
    if (contract.expiresAt.getTime() - Date.now() > EXPIRY_WINDOW_MS) {
      return
    }
    await this.prisma.reminder.upsert({
      where: {
        type_subjectId_dueAt: {
          type: 'contract_expiry',
          subjectId: contract.id,
          dueAt: contract.expiresAt,
        },
      },
      update: {},
      create: {
        type: 'contract_expiry',
        subjectId: contract.id,
        dueAt: contract.expiresAt,
      },
    })
  }

  private async generateContractNo(): Promise<string> {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const contractNo = `HT${date}${randomBytes(3).toString('hex').toUpperCase()}`
      const existing = await this.prisma.contract.findUnique({ where: { contractNo } })
      if (!existing) {
        return contractNo
      }
    }
    throw new BadRequestException('合同编号生成失败，请重试')
  }
}
