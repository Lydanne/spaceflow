FROM node:24-alpine AS builder

WORKDIR /app

ENV NODE_OPTIONS=--max-old-space-size=4096

RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

# 使用本地 pnpm pack 产物构建（例如 .docker/pkg/spaceflow-teax-0.1.0.tgz）
COPY .docker/pkg/ /tmp/pkg/
RUN set -eux; \
    PKG="$(find /tmp/pkg -maxdepth 1 -name '*.tgz' | sort | tail -n1)"; \
    test -n "$PKG"; \
    BAD_ENV="$(tar -tzf "$PKG" | grep -E '^package/\.env($|\.)' | grep -v '^package/\.env\.example$' || true)"; \
    test -z "$BAD_ENV"; \
    tar -xzf "$PKG" -C /app --strip-components=1
RUN pnpm install --no-frozen-lockfile
RUN pnpm nuxt:build


FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

COPY --from=builder /app/.output ./.output

EXPOSE 3000

USER nodeuser

CMD ["node", ".output/server/index.mjs"]
