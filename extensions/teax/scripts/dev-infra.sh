#!/usr/bin/env bash

set -euo pipefail

ACTION="${1:-start}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_CMD=()

detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
    return
  fi
  if command -v docker >/dev/null 2>&1; then
    COMPOSE_CMD=(
      docker run --rm -i
      -v /var/run/docker.sock:/var/run/docker.sock
      -v "${PROJECT_ROOT}:${PROJECT_ROOT}"
      -w "${PROJECT_ROOT}"
      docker/compose:2.39.4
    )
    return
  fi
  echo "Error: docker is not available." >&2
  exit 1
}

load_env() {
  local env_file="${PROJECT_ROOT}/.env"
  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$env_file"
    set +a
  fi
}

print_connections() {
  local pg_host="${POSTGRES_HOST:-localhost}"
  local pg_port="${POSTGRES_PORT:-5432}"
  local pg_user="${POSTGRES_USER:-postgres}"
  local pg_password="${POSTGRES_PASSWORD:-postgres}"
  local pg_db="${POSTGRES_DB:-teax}"
  local database_url="${DATABASE_URL:-postgresql://${pg_user}:${pg_password}@${pg_host}:${pg_port}/${pg_db}}"

  local redis_host="${REDIS_HOST:-localhost}"
  local redis_port="${REDIS_PORT:-6379}"
  local redis_url="${REDIS_URL:-}"
  if [ -z "$redis_url" ]; then
    if [ -n "${REDIS_PASSWORD:-}" ]; then
      redis_url="redis://:${REDIS_PASSWORD}@${redis_host}:${redis_port}"
    else
      redis_url="redis://${redis_host}:${redis_port}"
    fi
  fi

  echo "PostgreSQL:"
  echo "  host=${pg_host} port=${pg_port} user=${pg_user} password=${pg_password} db=${pg_db}"
  echo "  DATABASE_URL=${database_url}"
  echo
  echo "Redis:"
  if [ -n "${REDIS_PASSWORD:-}" ]; then
    echo "  host=${redis_host} port=${redis_port} password=${REDIS_PASSWORD}"
  else
    echo "  host=${redis_host} port=${redis_port}"
  fi
  echo "  REDIS_URL=${redis_url}"
}

load_env

if [ "${TEAX_IN_DEVCONTAINER:-}" = "1" ]; then
  case "$ACTION" in
    start|status)
      echo "Detected devcontainer environment, skip managing pg/redis from task."
      echo
      print_connections
      exit 0
      ;;
    stop|down)
      echo "Detected devcontainer environment, skip ${ACTION}."
      exit 0
      ;;
  esac
fi

detect_compose

case "$ACTION" in
  start)
    cd "${PROJECT_ROOT}"
    "${COMPOSE_CMD[@]}" up -d db redis
    echo
    print_connections
    ;;
  stop)
    cd "${PROJECT_ROOT}"
    "${COMPOSE_CMD[@]}" stop db redis
    ;;
  down)
    cd "${PROJECT_ROOT}"
    "${COMPOSE_CMD[@]}" down
    ;;
  status)
    cd "${PROJECT_ROOT}"
    "${COMPOSE_CMD[@]}" ps db redis
    echo
    print_connections
    ;;
  *)
    echo "Usage: $0 {start|stop|down|status}"
    exit 1
    ;;
esac
