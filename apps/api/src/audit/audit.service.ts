import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { existsSync } from 'node:fs'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { Role } from '@mall/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditQueryDto } from './dto/audit-query.dto'
import type { AuthUser } from '../auth/auth-user.type'

export interface AuditRecordInput {
  actor?: AuthUser | null
  action: string
  resourceType: string
  resourceId: string
  orderId?: string | null
  orderNo?: string | null
  boxCode?: string | null
  customerId?: string | null
  channelId?: string | null
  merchantId?: string | null
  detail?: unknown
}

type AuditLogRow = {
  id: string
  actorId: string | null
  actorRole: string | null
  action: string
  resourceType: string
  resourceId: string
  orderNo: string | null
  boxCode: string | null
  customerId: string | null
  channelId: string | null
  merchantId: string | null
  detail: Prisma.JsonValue | null
  createdAt: Date
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actor?.sub ?? null,
        actorRole: input.actor?.role ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        orderId: input.orderId ?? null,
        orderNo: input.orderNo ?? null,
        boxCode: input.boxCode ?? null,
        customerId: input.customerId ?? null,
        channelId: input.channelId ?? null,
        merchantId: input.merchantId ?? null,
        detail: input.detail === undefined ? undefined : (input.detail as Prisma.InputJsonValue),
      },
    })
  }

  async search(actor: AuthUser, query: AuditQueryDto) {
    const where = await this.buildWhere(actor, query)
    const page = query.page ?? 1
    const pageSize = Math.min(query.pageSize ?? 50, 200)
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ])
    return { items, total, page, pageSize }
  }

  async exportPackage(
    actor: AuthUser,
    query: AuditQueryDto,
    format: 'pdf' | 'excel',
  ): Promise<{ buffer: Buffer; filename: string; contentType: string; count: number }> {
    if (!query.purpose || query.purpose.trim().length < 2) {
      throw new BadRequestException('导出凭证包必须填写用途')
    }
    const where = await this.buildWhere(actor, query)
    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 5000,
    })

    const buffer =
      format === 'pdf' ? await this.toPdf(logs, query, actor) : await this.toExcel(logs, query, actor)

    await this.record({
      actor,
      action: 'audit.export',
      resourceType: 'audit',
      resourceId: `export-${Date.now()}`,
      orderNo: query.orderNo ?? null,
      boxCode: query.boxCode ?? null,
      detail: {
        format,
        purpose: query.purpose,
        count: logs.length,
        filters: {
          orderNo: query.orderNo,
          boxCode: query.boxCode,
          customer: query.customer,
          channelCode: query.channelCode,
          resourceType: query.resourceType,
          action: query.action,
          from: query.from,
          to: query.to,
        },
      },
    })

    return {
      buffer,
      filename: `audit-package-${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
      contentType:
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      count: logs.length,
    }
  }

  private async buildWhere(
    actor: AuthUser,
    query: AuditQueryDto,
  ): Promise<Prisma.AuditLogWhereInput> {
    const scope = await this.scopeWhere(actor)
    const filters: Prisma.AuditLogWhereInput[] = []

    if (query.orderNo) {
      filters.push({ orderNo: { contains: query.orderNo } })
    }
    if (query.boxCode) {
      filters.push({ boxCode: { contains: query.boxCode } })
    }
    if (query.customer) {
      const customer = await this.prisma.user.findFirst({
        where: { OR: [{ id: query.customer }, { phone: query.customer }] },
        select: { id: true },
      })
      filters.push({ customerId: customer?.id ?? '__none__' })
    }
    if (query.channelCode) {
      const channel = await this.prisma.channelIdentity.findUnique({
        where: { code: query.channelCode },
        select: { id: true },
      })
      filters.push({ channelId: channel?.id ?? '__none__' })
    }
    if (query.resourceType) {
      filters.push({ resourceType: query.resourceType })
    }
    if (query.action) {
      filters.push({ action: query.action })
    }
    if (query.from || query.to) {
      const createdAt: Prisma.DateTimeFilter = {}
      if (query.from) {
        createdAt.gte = new Date(query.from)
      }
      if (query.to) {
        createdAt.lte = new Date(query.to)
      }
      filters.push({ createdAt })
    }

    return filters.length > 0 ? { AND: [scope, ...filters] } : scope
  }

  private async scopeWhere(actor: AuthUser): Promise<Prisma.AuditLogWhereInput> {
    if (actor.roles.includes(Role.PLATFORM)) {
      return {}
    }
    if (actor.roles.includes(Role.MERCHANT)) {
      const orders = await this.prisma.salesOrder.findMany({
        where: { merchantId: actor.sub },
        select: { customerId: true },
        distinct: ['customerId'],
      })
      return {
        OR: [
          { merchantId: actor.sub },
          { actorId: actor.sub },
          { customerId: { in: orders.map((order) => order.customerId) } },
        ],
      }
    }
    if (actor.roles.includes(Role.SALES)) {
      const orders = await this.prisma.salesOrder.findMany({
        where: { attributedSalesId: actor.sub },
        select: { customerId: true },
        distinct: ['customerId'],
      })
      return {
        OR: [
          { actorId: actor.sub },
          { customerId: { in: orders.map((order) => order.customerId) } },
        ],
      }
    }
    if (actor.roles.includes(Role.PARTNER)) {
      const channels = await this.prisma.channelIdentity.findMany({
        where: { userId: actor.sub },
        select: { id: true },
      })
      return {
        OR: [
          { actorId: actor.sub },
          { channelId: { in: channels.map((channel) => channel.id) } },
        ],
      }
    }
    if (actor.roles.includes(Role.CUSTOMER)) {
      return { customerId: actor.sub }
    }
    return { actorId: actor.sub }
  }

  private async toExcel(
    logs: AuditLogRow[],
    query: AuditQueryDto,
    actor: AuthUser,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('审计明细')
    sheet.addRow(['导出人', `${actor.role} / ${actor.phone}`])
    sheet.addRow(['用途', query.purpose ?? ''])
    sheet.addRow(['导出时间', new Date().toISOString()])
    sheet.addRow(['筛选条件', JSON.stringify(this.filterSummary(query))])
    sheet.addRow([])
    sheet.addRow([
      '时间',
      '操作人',
      '角色',
      '动作',
      '资源类型',
      '资源ID',
      '订单号',
      '盒码',
      '客户ID',
      '渠道ID',
      '商家ID',
      '详情',
    ])
    for (const log of logs) {
      sheet.addRow([
        log.createdAt.toISOString(),
        log.actorId ?? '',
        log.actorRole ?? '',
        log.action,
        log.resourceType,
        log.resourceId,
        log.orderNo ?? '',
        log.boxCode ?? '',
        log.customerId ?? '',
        log.channelId ?? '',
        log.merchantId ?? '',
        log.detail ? JSON.stringify(log.detail) : '',
      ])
    }
    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  private async toPdf(
    logs: AuditLogRow[],
    query: AuditQueryDto,
    actor: AuthUser,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const candidates = [
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
        '/Library/Fonts/Arial Unicode.ttf',
      ]
      const fontPath = candidates.find((path) => existsSync(path))
      if (fontPath) {
        doc.font(fontPath)
      } else {
        doc.font('Helvetica')
      }

      doc.fontSize(16).text('合规留痕凭证包')
      doc.moveDown(0.5)
      doc.fontSize(10)
      doc.text(`导出人：${actor.role} / ${actor.phone}`)
      doc.text(`用途：${query.purpose}`)
      doc.text(`导出时间：${new Date().toISOString()}`)
      doc.text(`筛选条件：${JSON.stringify(this.filterSummary(query))}`)
      doc.text(`记录数：${logs.length}`)
      doc.moveDown()

      const counts = new Map<string, number>()
      for (const log of logs) {
        counts.set(log.resourceType, (counts.get(log.resourceType) ?? 0) + 1)
      }
      doc.fontSize(12).text('按资源类型汇总')
      doc.fontSize(10)
      for (const [type, count] of counts) {
        doc.text(`${type}：${count} 条`)
      }
      doc.moveDown()

      doc.fontSize(12).text('明细（最多 100 条）')
      doc.fontSize(9)
      for (const log of logs.slice(0, 100)) {
        const context = [
          log.orderNo ? `订单 ${log.orderNo}` : '',
          log.boxCode ? `盒码 ${log.boxCode}` : '',
          log.customerId ? `客户 ${log.customerId}` : '',
        ]
          .filter(Boolean)
          .join(' · ')
        doc.text(
          `${log.createdAt.toISOString()}  ${log.action}  ${log.resourceType}/${log.resourceId}  ${context}`,
        )
      }
      doc.end()
    })
  }

  private filterSummary(query: AuditQueryDto) {
    return {
      orderNo: query.orderNo,
      boxCode: query.boxCode,
      customer: query.customer,
      channelCode: query.channelCode,
      resourceType: query.resourceType,
      action: query.action,
      from: query.from,
      to: query.to,
    }
  }
}
