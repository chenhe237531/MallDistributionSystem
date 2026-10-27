#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
if ! mkdir -p "$DATA_DIR" 2>/dev/null; then
  echo "[startup] $DATA_DIR 不可写，回退到 /tmp/mall-data"
  DATA_DIR=/tmp/mall-data
  mkdir -p "$DATA_DIR"
fi

# 默认 SQLite；云托管环境变量里显式设置 DATABASE_URL 时优先使用
export DATABASE_URL="${DATABASE_URL:-file:$DATA_DIR/mall.db}"

case "$DATABASE_URL" in
  file:*)
    DB_PATH="${DATABASE_URL#file:}"
    mkdir -p "$(dirname "$DB_PATH")"
    if [ "${RESET_DB:-0}" = "1" ] || [ ! -f "$DB_PATH" ]; then
      cp /app/bootstrap.db "$DB_PATH"
      echo "[startup] SQLite 已初始化：$DB_PATH（预置演示数据）"
    else
      echo "[startup] 使用已有 SQLite：$DB_PATH"
    fi
    ;;
  *)
    echo "[startup] DATABASE_URL=$DATABASE_URL（本镜像为 SQLite 构建，非 file: 连接会启动失败）"
    ;;
esac

# 生产模式必须配置 JWT_SECRET；未配置时生成临时密钥，重启后登录态会失效
if [ -z "${JWT_SECRET:-}" ]; then
  export JWT_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  echo "[startup] JWT_SECRET 未配置，已生成临时密钥；建议在云托管环境变量中固定配置"
fi

echo "[startup] listening on 0.0.0.0:${PORT:-80}"
exec node dist/src/main.js
