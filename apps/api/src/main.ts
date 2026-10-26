import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { NextFunction, Request, Response } from 'express'
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

  // 后台与两个 H5 静态托管（云托管单服务部署）：
  // / → 后台，/b/ → 商家端 H5，/c/ → 客户端 H5；/api 与 /uploads 保持接口
  const findStaticDir = (candidates: Array<string | undefined>) =>
    candidates.find((candidate) => Boolean(candidate) && existsSync(candidate as string))
  const adminDir = findStaticDir([
    process.env.ADMIN_DIST_DIR,
    join(process.cwd(), 'public', 'admin'),
    join(__dirname, '..', '..', 'public', 'admin'),
    join(process.cwd(), '..', 'admin', 'dist'),
    join(__dirname, '..', '..', '..', 'admin', 'dist'),
  ])
  const miniBDir = findStaticDir([
    process.env.MINI_B_DIST_DIR,
    join(process.cwd(), 'public', 'b'),
    join(__dirname, '..', '..', 'public', 'b'),
    join(process.cwd(), '..', 'mini-b', 'dist-h5-b'),
    join(__dirname, '..', '..', '..', 'mini-b', 'dist-h5-b'),
  ])
  const miniCDir = findStaticDir([
    process.env.MINI_C_DIST_DIR,
    join(process.cwd(), 'public', 'c'),
    join(__dirname, '..', '..', 'public', 'c'),
    join(process.cwd(), '..', 'mini-c', 'dist-h5-c'),
    join(__dirname, '..', '..', '..', 'mini-c', 'dist-h5-c'),
  ])

  if (adminDir) {
    app.useStaticAssets(adminDir, { prefix: '/' })
  }
  if (miniBDir) {
    app.useStaticAssets(miniBDir, { prefix: '/b/' })
  }
  if (miniCDir) {
    app.useStaticAssets(miniCDir, { prefix: '/c/' })
  }

  if (adminDir || miniBDir || miniCDir) {
    const server = app.getHttpAdapter().getInstance() as {
      use: (handler: (req: Request, res: Response, next: NextFunction) => void) => void
    }
    server.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next()
      }
      const path = req.path
      if (path === '/api' || path.startsWith('/api/') || path.startsWith('/uploads/')) {
        return next()
      }
      if (miniBDir && path === '/b') {
        res.redirect(301, '/b/')
        return
      }
      if (miniCDir && path === '/c') {
        res.redirect(301, '/c/')
        return
      }
      if (miniBDir && path.startsWith('/b/')) {
        if (path.includes('.')) {
          return next()
        }
        res.sendFile(join(miniBDir, 'index.html'))
        return
      }
      if (miniCDir && path.startsWith('/c/')) {
        if (path.includes('.')) {
          return next()
        }
        res.sendFile(join(miniCDir, 'index.html'))
        return
      }
      if (path.startsWith('/b/') || path.startsWith('/c/')) {
        return next()
      }
      if (!adminDir || path.includes('.')) {
        return next()
      }
      res.sendFile(join(adminDir, 'index.html'))
    })
  }

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
  console.log(`API listening on http://localhost:${port}/api`)
}

void bootstrap()
