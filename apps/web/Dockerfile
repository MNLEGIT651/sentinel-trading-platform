# ─── Sentinel Web — Next.js Dashboard ────────────────────────────────────────
# Build context: monorepo root  (docker build -f apps/web/Dockerfile .)
FROM node:22-alpine AS base

LABEL org.opencontainers.image.source="https://github.com/stevenschling13/Trading-App"
LABEL org.opencontainers.image.description="Sentinel Trading Platform — Next.js Dashboard"

RUN npm install --global pnpm@10.32.1

# ─── Dependencies layer ───────────────────────────────────────────────────────
FROM base AS deps

WORKDIR /app

# pnpm workspace resolution requires all workspace member package.json files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/agents/package.json apps/agents/

RUN pnpm install --frozen-lockfile

# ─── Build layer ─────────────────────────────────────────────────────────────
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/ ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV STANDALONE_BUILD=1

ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ARG SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key

# Build-time only — NEXT_PUBLIC_ vars are inlined by the compiler,
# SUPABASE_SERVICE_ROLE_KEY is used during SSR build but must NOT
# persist in the runtime image (set via env at deploy time instead).
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

RUN pnpm --filter @sentinel/web build

# ─── Runtime image ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["node", "apps/web/server.js"]
