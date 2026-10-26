# 百英诺商城分销系统 · 腾讯云云托管（代码包 + Dockerfile）
# 单服务同时提供：后台管理前端 /、API /api、商品图片 /uploads，SQLite 默认落库 /data/mall.db
FROM node:22-bookworm-slim AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@12.14.0

WORKDIR /app
# 构建期 SQLite 基准库；运行期由 entrypoint 复制到 DATA_DIR
ENV DATABASE_URL="file:/app/bootstrap.db" \
    VITE_MERCHANT_H5_URL="/b/" \
    VITE_CUSTOMER_H5_URL="/c/"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc ./
COPY public ./public

COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src ./packages/shared/src

COPY apps/api/package.json apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json apps/api/
COPY apps/api/src ./apps/api/src
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/scripts ./apps/api/scripts
COPY apps/api/uploads ./apps/api/uploads

COPY apps/admin/package.json apps/admin/tsconfig.json apps/admin/vite.config.ts apps/admin/index.html apps/admin/
COPY apps/admin/src ./apps/admin/src

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @mall/shared build \
  && pnpm --filter @mall/admin build \
  && pnpm --filter @mall/api build \
  && pnpm --filter @mall/api db:push \
  && pnpm --filter @mall/api seed

# 生产运行时：只保留 API 生产依赖、预置 SQLite 演示库、后台静态文件与商品图片
RUN pnpm --filter @mall/api --prod deploy /app/runtime \
  && rm -rf /app/runtime/src /app/runtime/test /app/runtime/scripts /app/runtime/prisma \
  && cp -a /app/bootstrap.db /app/runtime/bootstrap.db \
  && mkdir -p /app/runtime/public /app/runtime/uploads \
  && cp -a /app/apps/admin/dist /app/runtime/public/admin \
  && cp -a /app/public/b /app/runtime/public/b \
  && cp -a /app/public/c /app/runtime/public/c \
  && cp -a /app/apps/api/uploads/. /app/runtime/uploads/ \
  && CLIENT_NODE_MODULES="$(dirname "$(dirname "$(readlink -f /app/runtime/node_modules/@prisma/client)")")" \
  && GENERATED_PRISMA="$(find /app/node_modules/.pnpm -maxdepth 4 -type d -name '.prisma' | head -n 1)" \
  && rm -rf "$CLIENT_NODE_MODULES/.prisma" \
  && cp -a "$GENERATED_PRISMA" "$CLIENT_NODE_MODULES/.prisma"

FROM node:22-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/runtime /app
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production \
    PORT=80 \
    DATA_DIR=/data \
    ADMIN_DIST_DIR=/app/public/admin \
    TZ=Asia/Shanghai

EXPOSE 80
CMD ["bash", "/app/entrypoint.sh"]
