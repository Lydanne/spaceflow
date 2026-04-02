FROM node:24-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && if apt-cache show docker-compose-plugin >/dev/null 2>&1; then \
    apt-get install -y --no-install-recommends docker.io docker-compose-plugin; \
  else \
    apt-get install -y --no-install-recommends docker.io docker-compose; \
  fi \
  && rm -rf /var/lib/apt/lists/*
