#!/usr/bin/env bash
# 生成可上传腾讯云云托管（代码包 + Dockerfile）的 zip
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/apps" "$STAGE/packages" "$ROOT/deploy/artifacts"

cp "$ROOT/package.json" "$ROOT/pnpm-lock.yaml" "$ROOT/tsconfig.base.json" "$ROOT/.npmrc" "$STAGE/"
cp "$ROOT/deploy/cloudbase/Dockerfile" "$ROOT/deploy/cloudbase/entrypoint.sh" "$ROOT/deploy/cloudbase/README.md" "$STAGE/"

# 只保留本服务需要的 workspace，避免安装/构建 Taro 小程序依赖
cat > "$STAGE/pnpm-workspace.yaml" <<'YAML'
packages:
  - 'packages/*'
  - 'apps/api'
  - 'apps/admin'

allowBuilds:
  '@nutui/nutui-react-taro': true
  '@parcel/watcher': true
  '@prisma/client': true
  '@prisma/engines': true
  '@swc/core': true
  '@tarojs/binding': true
  '@tarojs/cli': true
  core-js: true
  core-js-pure: true
  esbuild: true
  prisma: true
YAML

rsync -a \
  --exclude node_modules --exclude dist \
  "$ROOT/packages/shared" "$STAGE/packages/"

rsync -a \
  --exclude node_modules --exclude dist --exclude test --exclude .env \
  --exclude '*.db' --exclude '*.db-*' \
  --exclude 'schema.sqlite.prisma' --exclude 'schema.mysql.prisma' \
  "$ROOT/apps/api" "$STAGE/apps/"

rsync -a \
  --exclude node_modules --exclude dist \
  "$ROOT/apps/admin" "$STAGE/apps/"

# 预构建 H5（容器内不再安装 Taro 依赖）
if [ ! -f "$ROOT/apps/mini-b/dist-h5-b/index.html" ] || [ ! -f "$ROOT/apps/mini-c/dist-h5-c/index.html" ]; then
  echo "缺少 H5 构建产物，请先执行："
  echo "  env -u NODE_OPTIONS TARO_OUTPUT_ROOT=dist-h5-b TARO_PUBLIC_PATH=/b/ pnpm --filter @mall/mini-b build:h5"
  echo "  env -u NODE_OPTIONS TARO_OUTPUT_ROOT=dist-h5-c TARO_PUBLIC_PATH=/c/ pnpm --filter @mall/mini-c build:h5"
  exit 1
fi
mkdir -p "$STAGE/public"
rsync -a "$ROOT/apps/mini-b/dist-h5-b/" "$STAGE/public/b/"
rsync -a "$ROOT/apps/mini-c/dist-h5-c/" "$STAGE/public/c/"

find "$STAGE" \( -name '.DS_Store' -o -name '.env' -o -name '*.db' -o -name '*.db-*' \
  -o -name 'schema.sqlite.prisma' -o -name 'schema.mysql.prisma' \) -delete 2>/dev/null || true

OUT="$ROOT/deploy/artifacts/baiyingnuo-cloudbase-sqlite.zip"
rm -f "$OUT"
(cd "$STAGE" && zip -qr "$OUT" .)

echo "已生成：$OUT"
du -h "$OUT"
echo "--- 顶层内容 ---"
unzip -l "$OUT" | sed -n '4,20p'
