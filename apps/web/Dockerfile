# ─── Sentinel Web — Next.js 16 ───────────────────────────────────────────────
# Build context: monorepo root  (docker build -f apps/web/Dockerfile .)
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# ─── Dependencies layer ───────────────────────────────────────────────────────
FROM base AS deps

WORKDIR /app

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

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# SUPABASE_SERVICE_ROLE_KEY is runtime-only — never bake into image layers

# Warn if build args contain placeholders (real values required for production)
ARG VALIDATE_BUILD_ARGS=false
RUN if [ "$VALIDATE_BUILD_ARGS" = "true" ] && echo "$NEXT_PUBLIC_SUPABASE_URL" | grep -q "placeholder"; then \
      echo "ERROR: NEXT_PUBLIC_SUPABASE_URL still contains placeholder value." && \
      echo "Pass real build args: --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co" && \
      exit 1; \
    fi

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
  CMD node -e "const http = require('http'); http.get('http://localhost:' + (process.env.PORT || 3000) + '/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "apps/web/server.js"]
