# ─── Sentinel Agents — TypeScript Express ────────────────────────────────────
# Build context: monorepo root  (docker build -f apps/agents/Dockerfile .)
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# ─── Dependencies ─────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/agents/package.json apps/agents/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm rebuild

# ─── Build ────────────────────────────────────────────────────────────
FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/agents ./apps/agents
RUN pnpm --filter @sentinel/agents build

# ─── Production dependencies ─────────────────────────────────────────
FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/agents/package.json apps/agents/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod --ignore-scripts && pnpm rebuild

# ─── Runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Copy production deps (entire workspace to preserve pnpm link structure)
COPY --from=prod-deps /app ./

# Copy compiled agents output
COPY --from=build /app/apps/agents/dist ./apps/agents/dist

# Copy shared package source (workspace link target)
COPY --from=build /app/packages/shared ./packages/shared

RUN addgroup --system --gid 1001 sentinel \
  && adduser --system --uid 1001 --ingroup sentinel sentinel
USER sentinel

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD sh -c "wget -qO- http://localhost:${PORT:-3001}/health || exit 1"

CMD ["node", "apps/agents/dist/index.js"]
