#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_NAME="${1:-teax}"
IMAGE_TAG="${2:-latest}"
IMAGE_REF="${IMAGE_NAME}:${IMAGE_TAG}"
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

echo "[2/3] 构建 Docker 镜像: $IMAGE_REF"
docker build -t "$IMAGE_REF" .

echo "[3/3] 完成"
echo "镜像: $IMAGE_REF"
