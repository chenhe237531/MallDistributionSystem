import { Injectable, NotFoundException } from '@nestjs/common'
import { AuditService } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from '../auth/auth-user.type'

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(status?: string, type?: string) {
    return this.prisma.systemAlert.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  }

  async resolve(id: string, actor: AuthUser) {
    const alert = await this.prisma.systemAlert.findUnique({ where: { id } })
    if (!alert) {
      throw new NotFoundException('告警不存在')
    }
    if (alert.status === 'resolved') {
      return alert
    }
    const resolved = await this.prisma.systemAlert.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: actor.sub,
      },
    })
    await this.auditService.record({
      actor,
      action: 'alert.resolve',
      resourceType: 'alert',
      resourceId: alert.id,
      detail: { type: alert.type, subjectId: alert.subjectId },
    })
    return resolved
  }
}
