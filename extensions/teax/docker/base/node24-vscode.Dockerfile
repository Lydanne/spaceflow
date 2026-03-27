FROM node:24-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates curl wget openssh-client bash \
  && rm -rf /var/lib/apt/lists/*

# 提供可远程访问的 Web IDE 能力（code-server）
RUN npm install -g code-server

WORKDIR /runtime

CMD ["sleep", "infinity"]
