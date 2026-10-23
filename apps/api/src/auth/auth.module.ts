import { Logger } from '@nestjs/common'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { RolesGuard } from './roles.guard'

const DEV_JWT_SECRET = 'dev-secret-change-me'

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET')
        if (!secret) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET 未配置：生产环境禁止使用默认密钥启动')
          }
          new Logger('AuthModule').warn('JWT_SECRET 未配置，使用开发默认密钥，生产环境必须配置')
        }
        return {
          secret: secret ?? DEV_JWT_SECRET,
          signOptions: { expiresIn: '7d' },
        }
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
