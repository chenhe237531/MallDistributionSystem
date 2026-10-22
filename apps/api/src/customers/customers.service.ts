import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ReportAuthorizationDto } from '../samples/dto/activation.dto'
import { RealNameDto } from './dto/real-name.dto'

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async setRealName(userId: string, dto: RealNameDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException('账号不存在')
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        realName: dto.realName,
        idCardNo: dto.idCardNo.toUpperCase(),
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        realName: true,
        idCardNo: true,
        gender: true,
        birthDate: true,
      },
    })
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        realName: true,
        idCardNo: true,
        gender: true,
        birthDate: true,
        channels: true,
      },
    })
    if (!user) {
      throw new NotFoundException('账号不存在')
    }
    return user
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
}
