import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'

const EXPIRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async scanQualificationExpiry(): Promise<{ created: number }> {
    const now = new Date()
    const threshold = new Date(now.getTime() + EXPIRY_WINDOW_MS)
    const qualifications = await this.prisma.qualification.findMany({
      where: {
        expiresAt: { not: null, gte: now, lte: threshold },
        status: { in: ['pending', 'approved'] },
      },
    })

    for (const qualification of qualifications) {
      if (!qualification.expiresAt) {
        continue
      }
      await this.prisma.reminder.upsert({
        where: {
          type_subjectId_dueAt: {
            type: 'qualification_expiry',
            subjectId: qualification.userId,
            dueAt: qualification.expiresAt,
          },
        },
        update: { qualificationId: qualification.id },
        create: {
          type: 'qualification_expiry',
          subjectId: qualification.userId,
          dueAt: qualification.expiresAt,
          qualificationId: qualification.id,
        },
      })
    }

    const contracts = await this.prisma.contract.findMany({
      where: {
        status: { in: ['active', 'pending_renewal'] },
        expiresAt: { not: null, gte: now, lte: threshold },
      },
    })
    for (const contract of contracts) {
      if (!contract.expiresAt) {
        continue
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

    const learningRecords = await this.prisma.learningRecord.findMany({
      where: {
        status: 'passed',
        expiresAt: { not: null, gte: now, lte: threshold },
      },
    })
    for (const record of learningRecords) {
      if (!record.expiresAt) {
        continue
      }
      await this.prisma.reminder.upsert({
        where: {
          type_subjectId_dueAt: {
            type: 'training_expiry',
            subjectId: record.userId,
            dueAt: record.expiresAt,
          },
        },
        update: {},
        create: {
          type: 'training_expiry',
          subjectId: record.userId,
          dueAt: record.expiresAt,
        },
      })
    }

    return { created: qualifications.length + contracts.length + learningRecords.length }
  }

  async listMine(userId: string) {
    return this.prisma.reminder.findMany({
      where: { subjectId: userId },
      orderBy: { dueAt: 'asc' },
    })
  }

  async listAll() {
    return this.prisma.reminder.findMany({
      orderBy: { dueAt: 'asc' },
      include: {
        qualification: {
          include: { user: { select: { id: true, name: true, phone: true, roles: true } } },
        },
      },
    })
  }
}
