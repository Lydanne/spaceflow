#!/usr/bin/env bash
set -euo pipefail

# 用途: 可复现 Docker 构建（pnpm pack -> 容器内安装依赖并 nuxt build）
#
# 参数:
#   $1 IMAGE_NAME   可选，镜像名，默认: lydamirror/teax
#   $2 VERSION_TAG  可选，镜像标签，默认读取 package.json.version
#
# 环境变量:
#   PKG_DIR         可选，pnpm pack 产物目录，默认: .docker/pkg
#   DOCKER_PLATFORM 可选，目标平台，如 linux/amd64、linux/arm64
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
PKG_DIR="${PKG_DIR:-.docker/pkg}"

echo "[1/3] 生成本地 pnpm 打包产物..."
mkdir -p "$PKG_DIR"
pnpm pack --pack-destination "$PKG_DIR" >/tmp/teax-pnpm-pack.log

PKG_FILE="$(ls -1t "$PKG_DIR"/*.tgz | head -n1)"
if [[ -z "${PKG_FILE:-}" ]]; then
  echo "未找到打包产物: $PKG_DIR/*.tgz" >&2
  exit 1
fi
echo "已生成: $PKG_FILE"

echo "[2/3] 构建 Docker 镜像: $IMAGE_REF_VERSION"
BUILD_ARGS=()
if [[ -n "${DOCKER_PLATFORM:-}" ]]; then
  BUILD_ARGS+=(--platform "$DOCKER_PLATFORM")
fi
docker build "${BUILD_ARGS[@]}" -t "$IMAGE_REF_VERSION" .

if [[ "$VERSION_TAG" != "latest" ]]; then
  docker tag "$IMAGE_REF_VERSION" "$IMAGE_REF_LATEST"
fi

echo "[3/3] 完成"
if [[ "$VERSION_TAG" == "latest" ]]; then
  echo "镜像: $IMAGE_REF_VERSION"
else
  echo "镜像: $IMAGE_REF_VERSION"
  echo "镜像: $IMAGE_REF_LATEST"
fi
