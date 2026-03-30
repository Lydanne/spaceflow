#!/usr/bin/env bash
set -euo pipefail

# 用途: Docker 构建统一入口（默认 local 模式）
#
# 参数:
#   $1 IMAGE_NAME   可选，镜像名，默认: lydamirror/teax
#   $2 VERSION_TAG  可选，镜像标签，默认读取 package.json.version
#
# 环境变量:
#   BUILD_MODE      可选，local(默认) | repro
#                   local -> 调用 build-docker-local.sh
#                   repro -> 调用 build-docker-repro.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BUILD_MODE="${BUILD_MODE:-local}" # local | repro

case "$BUILD_MODE" in
  local)
    exec scripts/build-docker-local.sh "$@"
    ;;
  repro)
    exec scripts/build-docker-repro.sh "$@"
    ;;
  *)
    echo "BUILD_MODE 仅支持 local 或 repro，当前: $BUILD_MODE" >&2
    exit 1
    ;;
esac
