import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.setGlobalPrefix('api')
  app.enableCors({ origin: true, credentials: true })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  // 商品图片本地静态服务：apps/api/uploads/** → /uploads/**
  // 决策点 D1：生产环境可切换 OSS/CDN，仅需替换 URL 前缀，接口结构不变。
  // 兼容两种运行方式：nest start（dist/src → ../../uploads）与 node dist/src/main.js（cwd=apps/api）。
  const uploadsDir = [
    join(process.cwd(), 'uploads'),
    join(__dirname, '..', '..', 'uploads'),
    join(__dirname, '..', 'uploads'),
  ].find((candidate) => existsSync(candidate))
  if (uploadsDir) {
    app.useStaticAssets(uploadsDir, { prefix: '/uploads/' })
  } else {
    console.warn('[static] uploads 目录不存在，商品图片将回退为前端占位图')
  }

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
  console.log(`API listening on http://localhost:${port}/api`)
}

void bootstrap()
