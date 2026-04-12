# ─── Sentinel Web — Next.js 16 ───────────────────────────────────────────────
# Production-optimized standalone build
# Improvements:
#   - RUN cache mounts for pnpm store + Next.js cache
#   - Standalone output for minimal footprint (no .next/server duplication)
#   - Build arg validation to catch missing env vars early
#   - Source maps excluded from final image
#   - Alpine base for small final image
#
# Build context: monorepo root  (docker build -f apps/web/Dockerfile .)

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# ─── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/agents/package.json apps/agents/

# Cache mount for faster installs on rebuild
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile

# ─── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Validate critical build args (fail fast if still placeholder)
RUN if echo "$NEXT_PUBLIC_SUPABASE_URL" | grep -q "placeholder"; then \
      echo "ERROR: NEXT_PUBLIC_SUPABASE_URL is still placeholder value"; \
      echo "Pass real URL: --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co"; \
      exit 1; \
    fi

# Build with cache mount for .next artifacts (faster rebuilds)
RUN --mount=type=cache,target=/app/apps/web/.next/cache \
    pnpm --filter @sentinel/web build

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy standalone build output (minimal footprint, no .next/server duplication)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:' + (process.env.PORT || 3000) + '/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "apps/web/server.js"]
