FROM node:24-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates curl wget openssh-client bash \
  && rm -rf /var/lib/apt/lists/*

# 安装 OpenCode CLI
RUN npm install -g opencode-ai@latest

WORKDIR /runtime

CMD ["sleep", "infinity"]
