#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_NAME="${1:-teax}"
IMAGE_TAG="${2:-latest}"
IMAGE_REF="${IMAGE_NAME}:${IMAGE_TAG}"

CONTEXT_DIR=".docker/local-runtime-context"
DOCKERFILE_PATH="$CONTEXT_DIR/Dockerfile"

if [[ "${SKIP_LOCAL_BUILD:-0}" != "1" ]]; then
  echo "[1/4] 本地构建 Nuxt 产物..."
  pnpm nuxt:build
else
  echo "[1/4] 跳过本地构建 (SKIP_LOCAL_BUILD=1)"
fi

echo "[2/4] 准备最小 Docker 上下文..."
mkdir -p "$CONTEXT_DIR/.output"
rsync -a --delete .output/ "$CONTEXT_DIR/.output/"

cat > "$DOCKERFILE_PATH" <<'EOF'
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

COPY .output ./.output

EXPOSE 3000

USER nodeuser

CMD ["node", ".output/server/index.mjs"]
EOF

echo "[3/4] 构建 Docker 镜像: $IMAGE_REF"
docker build -f "$DOCKERFILE_PATH" -t "$IMAGE_REF" "$CONTEXT_DIR"

echo "[4/4] 完成"
echo "镜像: $IMAGE_REF"
