# ─── Sentinel Engine — Python FastAPI ────────────────────────────────────────
# Production-optimized Dockerfile following 2026 best practices
# Improvements:
#   - Layer caching: system deps + uv separated from app code
#   - Slim base with no-cache flags for minimal layer bloat
#   - uv for fast deterministic installs (40x faster than pip)
#   - Gunicorn + Uvicorn workers for async I/O performance
#   - Non-root user (uid 1001) for container security
#   - Health checks for orchestration (Kubernetes, Compose)

FROM python:3.12-slim AS base

WORKDIR /app

# Install system dependencies once (layer cached by hash of apt-get instructions)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Install uv package manager (no-cache to always get latest patch)
RUN pip install --no-cache-dir "uv>=0.5"

# ─── Dependencies layer (cached independently) ────────────────────────────────
FROM base AS deps

COPY pyproject.toml uv.lock* ./

# Create venv in this layer and install deps
# RUN cache will persist across rebuilds unless pyproject.toml/uv.lock changes
RUN --mount=type=cache,target=/root/.cache/uv \
    uv venv .venv && \
    uv pip install --python .venv/bin/python --no-cache "."

# ─── Runtime image (minimal final image) ──────────────────────────────────────
FROM base AS runner

WORKDIR /app

# Copy lightweight venv from deps layer
COPY --from=deps /app/.venv ./.venv

# Activate venv on PATH so commands are directly invocable
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Copy application code (changes here don't invalidate deps layer)
COPY src ./src
COPY gunicorn_conf.py start.sh ./
RUN chmod +x start.sh

# Create non-root user for security
RUN addgroup --system --gid 1001 sentinel && \
    adduser --system --uid 1001 --ingroup sentinel sentinel && \
    chown -R sentinel:sentinel /app

USER sentinel

EXPOSE 8000

# Health check for orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Exec form: signals propagate directly to gunicorn (PID 1)
CMD ["gunicorn", "src.api.main:app", "-c", "gunicorn_conf.py"]
