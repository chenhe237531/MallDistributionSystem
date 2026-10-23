import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import {
  BoxCodeStatus,
  Prisma,
  SampleStatus,
} from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { Role } from '@mall/shared'
import { AuditService } from '../audit/audit.service'
import { BoxCodesService } from '../box-codes/box-codes.service'
import { CommissionsService } from '../commissions/commissions.service'
import { NotificationsService } from '../notifications/notifications.service'
import { PrismaService } from '../prisma/prisma.service'
import { ActivateBoxCodeDto, ReportAuthorizationDto } from './dto/activation.dto'
import {
  AbnormalityDto,
  MailSampleDto,
  ReceiveSampleDto,
  ResampleDto,
} from './dto/sample-flow.dto'
import type { AuthUser } from '../auth/auth-user.type'

const DEFAULT_QUESTIONNAIRE_FIELDS = [
  { key: 'gender', label: '性别', required: true },
  { key: 'age', label: '年龄', required: true },
]

type QuestionnaireField = { key: string; label?: string; required?: boolean }

@Injectable()
export class SamplesService {
  private readonly logger = new Logger(SamplesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly boxCodesService: BoxCodesService,
    private readonly commissionsService: CommissionsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async activate(actor: AuthUser, dto: ActivateBoxCodeDto) {
    if (!actor.roles.includes(Role.CUSTOMER)) {
      throw new ForbiddenException('只有 C 端用户可以激活盒码')
    }
    const customer = await this.prisma.user.findUnique({ where: { id: actor.sub } })
    if (!customer) {
      throw new NotFoundException('账号不存在')
    }
    if (!customer.realName || !customer.idCardNo) {
      throw new BadRequestException('请先完成实名认证')
    }
    if (!dto.consentGiven) {
      throw new BadRequestException('需签署检测服务协议与知情同意书')
    }

    const box = await this.prisma.boxCode.findUnique({
      where: { code: dto.boxCode },
      include: { procurementOrder: true },
    })
    if (!box) {
      throw new NotFoundException('盒码不存在')
    }
    if (box.status === BoxCodeStatus.voided) {
      const reason = box.voidReason ?? ''
      const reappeared = reason.includes('补码') || reason.includes('渠道码')
      await this.prisma.systemAlert.create({
        data: {
          type: reappeared ? 'box_code_old_code_reappear' : 'box_code_voided_scan',
          subjectType: 'box_code',
          subjectId: box.id,
          message: reappeared
            ? `已作废补码 ${box.code} 再次被扫描，请人工核查`
            : `作废盒码 ${box.code} 被 ${actor.phone} 扫描激活`,
          severity: 'warning',
        },
      })
      throw new BadRequestException('盒码已作废，请联系客服')
    }
    if (box.status !== BoxCodeStatus.generated) {
      await this.prisma.systemAlert.create({
        data: {
          type: 'box_code_multi_scan',
          subjectType: 'box_code',
          subjectId: box.id,
          message: `盒码 ${box.code} 已被使用后又被 ${actor.phone} 扫描，触发异常扫描核查`,
          severity: 'warning',
        },
      })
      throw new ConflictException('该盒已被使用，请联系客服')
    }

    const order = dto.orderId
      ? await this.prisma.salesOrder.findUnique({ where: { id: dto.orderId } })
      : null
    if (dto.orderId && !order) {
      throw new NotFoundException('订单不存在')
    }
    if (order && order.customerId !== actor.sub) {
      throw new ForbiddenException('只能激活本人订单的盒码')
    }
    if (order?.preAttributionChannelId && order.preAttributionChannelId !== box.channelId) {
      await this.prisma.systemAlert.create({
        data: {
          type: 'box_code_channel_mismatch',
          subjectType: 'box_code',
          subjectId: box.id,
          message: `盒码 ${box.code} 的出库渠道与订单 ${order.orderNo} 预归属渠道不一致，按盒码归属并转人工核查`,
          severity: 'warning',
        },
      })
    }

    const fields = await this.questionnaireFields(box.productId)
    for (const field of fields) {
      if (!field.required) {
        continue
      }
      const value = dto.questionnaire[field.key]
      if (value === undefined || value === null || value === '') {
        throw new BadRequestException(`请填写${field.label ?? field.key}`)
      }
    }

    const template = await this.prisma.contractTemplate.findFirst({
      where: { code: 'customer_detection', active: true },
      orderBy: { version: 'desc' },
    })
    const channel = await this.prisma.channelIdentity.findUnique({ where: { id: box.channelId } })
    const channelType = channel?.type ?? 'merchant'
    const merchantId = channelType === 'merchant' ? box.merchantId : null

    const result = await this.prisma.$transaction(async (tx) => {
      const existingOwnership = await tx.customerOwnership.findUnique({
        where: { customerId: actor.sub },
      })
      const ownership =
        existingOwnership ??
        (await tx.customerOwnership.create({
          data: {
            customerId: actor.sub,
            channelId: box.channelId,
            channelType,
            merchantId,
            sourceBoxCode: box.code,
          },
        }))

      const consent = await tx.consentRecord.create({
        data: {
          customerId: actor.sub,
          orderId: dto.orderId,
          boxCode: box.code,
          templateCode: 'customer_detection',
          templateVersion: template?.version ?? 1,
          reportAuthorization: dto.reportAuthorization,
          ip: dto.ip,
          device: dto.device,
        },
      })

      const sample = await tx.sample.create({
        data: {
          sampleNo: this.generateSampleNo(),
          boxCodeId: box.id,
          orderId: dto.orderId,
          customerId: actor.sub,
          merchantId: box.merchantId,
          channelId: box.channelId,
          status: SampleStatus.activated,
          samplingMethod: dto.samplingMethod,
          questionnaire: dto.questionnaire as Prisma.InputJsonValue,
        },
        include: { boxCode: true },
      })

      await tx.boxCode.update({
        where: { id: box.id },
        data: { status: BoxCodeStatus.active, activatedAt: new Date() },
      })
      await tx.sampleEvent.create({
        data: { sampleId: sample.id, type: 'activated', operatorId: actor.sub },
      })

      if (order) {
        await tx.salesOrder.update({
          where: { id: order.id },
          data: {
            attributedChannelId: box.channelId,
          },
        })
      }

      return { sample, ownership, consent }
    })

    await this.auditService.record({
      actor,
      action: 'consent.agree',
      resourceType: 'consent',
      resourceId: result.consent.id,
      orderId: dto.orderId ?? null,
      orderNo: order?.orderNo ?? null,
      boxCode: box.code,
      customerId: actor.sub,
      channelId: box.channelId,
      merchantId: box.merchantId,
      detail: {
        templateCode: result.consent.templateCode,
        templateVersion: result.consent.templateVersion,
        reportAuthorization: result.consent.reportAuthorization,
      },
    })
    await this.auditService.record({
      actor,
      action: 'sample.activate',
      resourceType: 'sample',
      resourceId: result.sample.id,
      orderId: dto.orderId ?? null,
      orderNo: order?.orderNo ?? null,
      boxCode: box.code,
      customerId: actor.sub,
      channelId: box.channelId,
      merchantId: box.merchantId,
      detail: { sampleNo: result.sample.sampleNo, samplingMethod: dto.samplingMethod },
    })

    if (dto.orderId) {
      try {
        await this.commissionsService.recomputeForOrder(dto.orderId)
      } catch (error) {
        this.logger.warn(`激活后重算佣金失败：${String(error)}`)
      }
    }
    return result
  }

  async listMine(customerId: string) {
    return this.prisma.sample.findMany({
      where: { customerId },
      include: { boxCode: true, events: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async list(actor: AuthUser) {
    const where: Prisma.SampleWhereInput = actor.roles.includes(Role.PLATFORM)
      ? {}
      : actor.roles.includes(Role.LAB)
        ? {}
        : actor.roles.includes(Role.MERCHANT)
          ? { merchantId: actor.sub }
          : { id: '__none__' }
    return this.prisma.sample.findMany({
      where,
      include: {
        boxCode: true,
        customer: { select: { id: true, name: true, phone: true, realName: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getOne(id: string, actor: AuthUser) {
    const sample = await this.prisma.sample.findUnique({
      where: { id },
      include: {
        boxCode: true,
        customer: { select: { id: true, name: true, phone: true, realName: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!sample) {
      throw new NotFoundException('样本不存在')
    }
    if (
      !actor.roles.includes(Role.PLATFORM) &&
      !actor.roles.includes(Role.LAB) &&
      sample.customerId !== actor.sub &&
      !(actor.roles.includes(Role.MERCHANT) && sample.merchantId === actor.sub)
    ) {
      throw new ForbiddenException('无权查看该样本')
    }
    return sample
  }

  async markMailed(id: string, dto: MailSampleDto, actor: AuthUser) {
    const sample = await this.getOne(id, actor)
    if (sample.customerId !== actor.sub) {
      throw new ForbiddenException('只有样本本人可以登记寄出')
    }
    if (
      sample.status !== SampleStatus.activated &&
      sample.status !== SampleStatus.pending_mail
    ) {
      throw new BadRequestException('当前状态不能登记寄出')
    }
    return this.setStatus(
      id,
      SampleStatus.in_transit,
      'mailed',
      dto.trackingNo ? `运单号 ${dto.trackingNo}` : undefined,
      actor.sub,
    )
  }

  async receive(id: string, dto: ReceiveSampleDto, actor: AuthUser) {
    await this.assertLabOrPlatform(actor)
    const sample = await this.getOne(id, actor)
    if (
      sample.status !== SampleStatus.in_transit &&
      sample.status !== SampleStatus.activated
    ) {
      throw new BadRequestException('当前状态不能收样')
    }

    const failures: string[] = []
    if (!dto.boxCodeMatched) failures.push('盒码不符')
    if (!dto.samplingTimeValid) failures.push('采样时间不符合要求')
    if (!dto.storageConditionOk) failures.push('保存条件不合格')
    if (!dto.transitWithinLimit) failures.push('运输时长超限')

    if (failures.length > 0) {
      const reason = failures.join('；')
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.sample.update({
          where: { id },
          data: { status: SampleStatus.abnormal, abnormalReason: reason },
        })
        await tx.sampleEvent.create({
          data: {
            sampleId: id,
            type: 'abnormal_received',
            note: dto.note ? `${reason}（${dto.note}）` : reason,
            operatorId: actor.sub,
          },
        })
        return result
      })
      await this.notificationsService.emit({
        type: 'sample_abnormal',
        recipientId: sample.customerId,
        recipientRole: Role.CUSTOMER,
        subjectType: 'sample',
        subjectId: sample.id,
        title: '样本异常，需补采',
        body: `样本 ${sample.sampleNo} 收样异常，平台将安排补采，请留意后续通知。`,
        templateCode: 'sample_abnormal',
        dedupeKey: `sample_abnormal:${sample.id}:${Date.now()}`,
        payload: { sampleId: sample.id, sampleNo: sample.sampleNo },
      })
      return updated
    }

    const received = await this.setStatus(
      id,
      SampleStatus.received_by_lab,
      'received_by_lab',
      dto.note,
      actor.sub,
    )
    await this.notificationsService.emit({
      type: 'sample_received',
      recipientId: sample.customerId,
      recipientRole: Role.CUSTOMER,
      subjectType: 'sample',
      subjectId: sample.id,
      title: '实验室已收样',
      body: `样本 ${sample.sampleNo} 已到达实验室，检测完成后将生成报告。`,
      templateCode: 'sample_received',
      dedupeKey: `sample_received:${sample.id}`,
      payload: { sampleId: sample.id, sampleNo: sample.sampleNo },
    })
    return received
  }

  async startTesting(id: string, actor: AuthUser) {
    await this.assertLabOrPlatform(actor)
    const sample = await this.getOne(id, actor)
    if (sample.status !== SampleStatus.received_by_lab) {
      throw new BadRequestException('当前状态不能开始检测')
    }
    return this.setStatus(id, SampleStatus.testing, 'testing', undefined, actor.sub)
  }

  async markAbnormal(id: string, dto: AbnormalityDto, actor: AuthUser) {
    await this.assertLabOrPlatform(actor)
    const sample = await this.getOne(id, actor)
    if (sample.status === SampleStatus.published || sample.status === SampleStatus.voided) {
      throw new BadRequestException('当前状态不能登记异常')
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sample.update({
        where: { id },
        data: { status: SampleStatus.abnormal, abnormalReason: dto.reason },
      })
      await tx.sampleEvent.create({
        data: {
          sampleId: id,
          type: 'abnormal',
          note: dto.reason,
          operatorId: actor.sub,
        },
      })
      return updated
    })
  }

  async resample(id: string, dto: ResampleDto, actor: AuthUser) {
    await this.assertLabOrPlatform(actor)
    const sample = await this.getOne(id, actor)
    if (sample.status !== SampleStatus.abnormal) {
      throw new BadRequestException('只有异常样本可以补采')
    }
    if (sample.resampleCount >= 2) {
      throw new BadRequestException('补采次数已达上限（2 次）')
    }

    const newBoxCode = await this.boxCodesService.createSupplement(sample.boxCode.id)
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.sample.update({
        where: { id },
        data: { resampleCount: { increment: 1 } },
      })
      await tx.sampleEvent.create({
        data: {
          sampleId: id,
          type: 'resample',
          note: `补采盒码 ${newBoxCode.code}${dto.reason ? `：${dto.reason}` : ''}`,
          operatorId: actor.sub,
        },
      })
      return result
    })
    return { boxCode: newBoxCode, sample: updated }
  }

  async voidSample(id: string, actor: AuthUser) {
    await this.assertLabOrPlatform(actor)
    const sample = await this.getOne(id, actor)
    if (sample.status === SampleStatus.published) {
      throw new BadRequestException('已发布报告的样本不能作废')
    }
    return this.setStatus(id, SampleStatus.voided, 'voided', undefined, actor.sub)
  }

  async getOwnership(customerId: string) {
    const ownership = await this.prisma.customerOwnership.findUnique({
      where: { customerId },
    })
    const consent = await this.prisma.consentRecord.findFirst({
      where: { customerId },
      orderBy: { agreedAt: 'desc' },
    })
    const samples = await this.prisma.sample.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: { boxCode: true },
    })
    return { ownership, consent, samples }
  }

  async setReportAuthorization(customerId: string, dto: ReportAuthorizationDto) {
    const consent = await this.prisma.consentRecord.findFirst({
      where: { customerId },
      orderBy: { agreedAt: 'desc' },
    })
    if (!consent) {
      throw new NotFoundException('尚未签署知情同意书')
    }
    return this.prisma.consentRecord.update({
      where: { id: consent.id },
      data: { reportAuthorization: dto.authorized },
    })
  }

  private async questionnaireFields(productId: string): Promise<QuestionnaireField[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { questionnaireFields: true },
    })
    const fields = product?.questionnaireFields
    if (Array.isArray(fields) && fields.length > 0) {
      return fields as QuestionnaireField[]
    }
    return DEFAULT_QUESTIONNAIRE_FIELDS
  }

  private generateSampleNo(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return `SP${date}${randomBytes(3).toString('hex').toUpperCase()}`
  }

  async assertLabOrPlatform(actor: AuthUser): Promise<void> {
    if (!actor.roles.includes(Role.LAB) && !actor.roles.includes(Role.PLATFORM)) {
      throw new ForbiddenException('只有实验室或平台可以执行该操作')
    }
  }

  async setStatus(
    sampleId: string,
    status: SampleStatus,
    eventType: string,
    note?: string,
    operatorId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sample = await tx.sample.update({
        where: { id: sampleId },
        data: {
          status,
          ...(status === SampleStatus.received_by_lab ? { receivedAt: new Date() } : {}),
        },
      })
      await tx.sampleEvent.create({
        data: { sampleId, type: eventType, note, operatorId },
      })
      return sample
    })
  }
}
