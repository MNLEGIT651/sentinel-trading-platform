# ─── Sentinel Agents — TypeScript Express ────────────────────────────────────
# Production-optimized multi-stage build for monorepo
# Improvements:
#   - Explicit dependency isolation for build caching
#   - pnpm layer caching independent of app code
#   - RUN cache mount for pnpm store persistence
#   - Minimal final image (source maps excluded)
#   - Alpine base for small footprint
#
# Build context: monorepo root  (docker build -f apps/agents/Dockerfile .)

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# ─── Dependencies layer (cached independently) ────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy only dependency manifests and workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/agents/package.json apps/agents/
COPY apps/web/package.json apps/web/

# Install with cache mount for pnpm store
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile --ignore-scripts && \
    pnpm rebuild

# ─── Build stage ──────────────────────────────────────────────────────────────
FROM deps AS build

# Copy source after deps are cached
COPY packages/shared ./packages/shared
COPY apps/agents ./apps/agents
COPY tsconfig.base.json ./

# Build agents application
RUN pnpm --filter @sentinel/agents build

# ─── Production dependencies (no devDeps) ─────────────────────────────────────
FROM base AS prod-deps
WORKDIR /app

# Re-use locked deps but install only production
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/agents/package.json apps/agents/
COPY apps/web/package.json apps/web/

RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile --prod --ignore-scripts && \
    pnpm rebuild

# ─── Runtime image ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy prod deps with workspace structure intact (for pnpm links)
COPY --from=prod-deps /app ./

# Copy compiled agent output
COPY --from=build /app/apps/agents/dist ./apps/agents/dist

# Copy shared package source (workspace link target)
COPY --from=build /app/packages/shared ./packages/shared

# Create non-root user
RUN addgroup --system --gid 1001 sentinel && \
    adduser --system --uid 1001 --ingroup sentinel sentinel
USER sentinel

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:' + (process.env.PORT || 3001) + '/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start compiled app
CMD ["node", "apps/agents/dist/index.js"]
