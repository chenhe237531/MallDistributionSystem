import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AccountStatus as PrismaAccountStatus, User } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { Role, type UserSummary } from '@mall/shared'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import type { AuthUser } from './auth-user.type'

export interface AuthResult {
  token: string
  user: UserSummary & { status: string; organizationName?: string }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registerCustomer(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } })
    if (existing) {
      throw new ConflictException('该手机号已注册')
    }

    const deviceId = dto.deviceId?.trim() || null
    let riskLevel = 'normal'
    if (deviceId) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const sameDeviceCount = await this.prisma.user.count({
        where: { deviceId, createdAt: { gte: since } },
      })
      if (sameDeviceCount >= 2) {
        riskLevel = 'watch'
      }
    }

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: dto.name,
        roles: ['customer'],
        primaryRole: 'customer',
        status: PrismaAccountStatus.active,
        deviceId,
        riskLevel,
      },
    })
    if (riskLevel === 'watch') {
      await this.prisma.systemAlert.create({
        data: {
          type: 'abnormal_registration',
          subjectType: 'user',
          subjectId: user.id,
          message: `同一设备 24 小时内批量注册，账号 ${user.phone} 进入风险名单，佣金延迟进入待对账`,
          severity: 'warning',
        },
      })
    }
    return this.issueToken(user)
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: { organization: true },
    })
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('手机号或密码不正确')
    }
    if (user.status !== PrismaAccountStatus.active) {
      throw new ForbiddenException('账号未启用或已停用')
    }
    return this.issueToken(user)
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true, channels: true },
    })
    if (!user) {
      throw new UnauthorizedException('账号不存在')
    }
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      roles: user.roles,
      primaryRole: user.primaryRole,
      status: user.status,
      organizationId: user.organizationId,
      organizationName: user.organization?.name,
      realName: user.realName,
      idCardNo: user.idCardNo,
      gender: user.gender,
      birthDate: user.birthDate,
      channels: user.channels.map((channel) => ({
        code: channel.code,
        type: channel.type,
        status: channel.status,
      })),
    }
  }

  private async issueToken(user: User): Promise<AuthResult> {
    const roles = user.roles as unknown as Role[]
    const role = user.primaryRole as unknown as Role
    const payload: AuthUser = {
      sub: user.id,
      phone: user.phone,
      roles,
      role,
      orgId: user.organizationId ?? undefined,
    }
    return {
      token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role,
        status: user.status,
      },
    }
  }
}
