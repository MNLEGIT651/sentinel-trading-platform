# ─── Sentinel Agents — TypeScript Express ────────────────────────────────────
# Build context: monorepo root  (docker build -f apps/agents/Dockerfile .)
FROM node:22-alpine AS base

RUN npm install --global pnpm@10.32.1

# ─── Dependencies + Runtime ───────────────────────────────────────────────────
FROM base AS runner

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/agents/package.json apps/agents/

RUN pnpm install --frozen-lockfile

# Copy source after deps (layer cache: deps change less often than src)
COPY packages/shared ./packages/shared
COPY apps/agents ./apps/agents

RUN addgroup --system --gid 1001 sentinel \
  && adduser --system --uid 1001 --ingroup sentinel sentinel
USER sentinel

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node_modules/.bin/tsx", "apps/agents/src/index.ts"]
