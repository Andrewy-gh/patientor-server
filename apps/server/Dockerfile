# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vite.config.ts ./
COPY apps/server/package.json apps/server/package.json
COPY packages/api/package.json packages/api/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts --filter server...

FROM deps AS build

COPY apps/server apps/server
COPY packages/api packages/api

RUN pnpm --filter @patientor/api build
RUN pnpm --filter server build
RUN pnpm deploy --legacy --ignore-scripts --filter server --prod /runtime

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV="production"
ENV PORT="3001"

WORKDIR /app

COPY --from=build /runtime ./

RUN touch .env

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "const port = process.env.PORT || '3001'; fetch('http://127.0.0.1:' + port + '/api/v1/ping').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "build/src/index.js"]
