#!/usr/bin/env bash
set -euo pipefail

# 用途: 一键发布 Docker 镜像（构建 + push）
#
# 参数:
#   $1 IMAGE_NAME   可选，完整镜像名，默认: lydamirror/teax
#   $2 VERSION_TAG  可选，镜像标签，默认读取 package.json.version
#
# 环境变量:
#   BUILD_MODE      可选，local(默认) | repro
#   DOCKER_PLATFORM 可选，目标平台，如 linux/amd64、linux/arm64（透传给构建脚本）
#   PUSH_LATEST     可选，1(默认) | 0，是否推送 latest 标签
#   DRY_RUN         可选，1 | 0(默认)，仅打印命令不执行
#   IMAGE_NAME      可选，与 $1 等价（当 $1 未提供时使用）
#   VERSION_TAG     可选，与 $2 等价（当 $2 未提供时使用）

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_NAME="${1:-${IMAGE_NAME:-lydamirror/teax}}"
if [[ -z "$IMAGE_NAME" ]]; then
  echo "用法: scripts/publish-docker.sh [image-name] [tag]" >&2
  exit 1
fi

VERSION_TAG="${2:-${VERSION_TAG:-$(node -p "require('./package.json').version || ''")}}"
if [[ -z "$VERSION_TAG" ]]; then
  echo "package.json 中缺少 version，且未传入 tag" >&2
  exit 1
fi

BUILD_MODE="${BUILD_MODE:-local}" # repro | local
PUSH_LATEST="${PUSH_LATEST:-1}"   # 1 | 0
DRY_RUN="${DRY_RUN:-0}"           # 1 | 0

run_cmd() {
  echo "+ $*"
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  "$@"
}

case "$BUILD_MODE" in
  repro|local) ;;
  *)
    echo "BUILD_MODE 仅支持 repro 或 local，当前: $BUILD_MODE" >&2
    exit 1
    ;;
esac

echo "镜像仓库: $IMAGE_NAME"
echo "版本标签: $VERSION_TAG"
echo "构建模式: $BUILD_MODE"
echo "推送 latest: $PUSH_LATEST"
echo "DRY_RUN: $DRY_RUN"

if [[ "$BUILD_MODE" == "local" ]]; then
  run_cmd scripts/build-docker.sh "$IMAGE_NAME" "$VERSION_TAG"
else
  run_cmd scripts/build-docker-repro.sh "$IMAGE_NAME" "$VERSION_TAG"
fi

run_cmd docker push "${IMAGE_NAME}:${VERSION_TAG}"

if [[ "$PUSH_LATEST" == "1" && "$VERSION_TAG" != "latest" ]]; then
  run_cmd docker push "${IMAGE_NAME}:latest"
fi

echo "发布完成"
