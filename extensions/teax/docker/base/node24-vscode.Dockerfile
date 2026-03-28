FROM node:24-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN set -eux; \
    attempts=0; \
    until apt-get update -o Acquire::Retries=3; do \
      attempts=$((attempts + 1)); \
      if [ "$attempts" -ge 5 ]; then \
        echo "apt-get update failed after $attempts attempts"; \
        exit 1; \
      fi; \
      echo "apt-get update failed, retrying in 20s..."; \
      sleep 20; \
    done; \
    apt-get install -y --no-install-recommends \
      git ca-certificates curl wget openssh-client bash; \
    rm -rf /var/lib/apt/lists/*

# 安装 OpenCode CLI
RUN set -eux; \
    unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy; \
    npm config delete proxy || true; \
    npm config delete https-proxy || true; \
    attempts=0; \
    until npm install -g --no-audit --no-fund opencode-ai@latest; do \
      attempts=$((attempts + 1)); \
      if [ "$attempts" -ge 5 ]; then \
        echo "npm install failed after $attempts attempts"; \
        exit 1; \
      fi; \
      echo "npm install failed, retrying in 20s..."; \
      sleep 20; \
    done

WORKDIR /runtime

CMD ["sleep", "infinity"]
