#!/usr/bin/env bash
set -euo pipefail

# 用途: 本地加速构建 Docker 镜像（本地先 nuxt build，再打包 .output）
#
# 参数:
#   $1 IMAGE_NAME   可选，镜像名，默认: lydamirror/teax
#   $2 VERSION_TAG  可选，镜像标签，默认读取 package.json.version
#
# 环境变量:
#   SKIP_LOCAL_BUILD  可选，1 表示跳过本地 nuxt build（默认 0）
#   DOCKER_PLATFORM   可选，目标平台，如 linux/amd64、linux/arm64
#   说明: 构建完成后会自动生成两个标签:
#         <IMAGE_NAME>:<VERSION_TAG> 和 <IMAGE_NAME>:latest

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_NAME="${1:-lydamirror/teax}"
VERSION_TAG="${2:-$(node -p "require('./package.json').version || ''")}"
if [[ -z "$VERSION_TAG" ]]; then
  echo "package.json 中缺少 version，且未传入镜像 tag" >&2
  exit 1
fi
IMAGE_REF_VERSION="${IMAGE_NAME}:${VERSION_TAG}"
IMAGE_REF_LATEST="${IMAGE_NAME}:latest"

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

echo "[3/4] 构建 Docker 镜像: $IMAGE_REF_VERSION"
BUILD_ARGS=()
if [[ -n "${DOCKER_PLATFORM:-}" ]]; then
  BUILD_ARGS+=(--platform "$DOCKER_PLATFORM")
fi
docker build "${BUILD_ARGS[@]}" -f "$DOCKERFILE_PATH" -t "$IMAGE_REF_VERSION" "$CONTEXT_DIR"

if [[ "$VERSION_TAG" != "latest" ]]; then
  docker tag "$IMAGE_REF_VERSION" "$IMAGE_REF_LATEST"
fi

echo "[4/4] 完成"
if [[ "$VERSION_TAG" == "latest" ]]; then
  echo "镜像: $IMAGE_REF_VERSION"
else
  echo "镜像: $IMAGE_REF_VERSION"
  echo "镜像: $IMAGE_REF_LATEST"
fi
