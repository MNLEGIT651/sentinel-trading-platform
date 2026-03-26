# ─── Sentinel Engine — Python FastAPI ────────────────────────────────────────
# Multi-stage production-optimized Dockerfile
# - Python 3.12 with Gunicorn + Uvicorn workers (uvloop, httptools)
# - uv for fast dependency installation
# - Non-root user, health checks for orchestration platforms

FROM python:3.12-slim AS base

LABEL org.opencontainers.image.source="https://github.com/stevenschling13/Trading-App"
LABEL org.opencontainers.image.description="Sentinel Trading Platform — Quant Engine"

WORKDIR /app

# Install system dependencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# Install uv package manager (pinned for reproducible builds)
RUN pip install --no-cache-dir "uv>=0.5,<1"

# ─── Dependencies layer ───────────────────────────────────────────────────────
FROM base AS deps

COPY pyproject.toml ./

# Create venv and install production dependencies only
RUN uv venv .venv \
  && uv pip install --python .venv/bin/python --no-cache "."

# ─── Runtime image ────────────────────────────────────────────────────────────
FROM base AS runner

WORKDIR /app

# Copy virtual environment from deps stage
COPY --from=deps /app/.venv ./.venv

# Copy application code
COPY src ./src
COPY gunicorn_conf.py ./

# Create non-root user for security
RUN addgroup --system --gid 1001 sentinel \
  && adduser --system --uid 1001 --ingroup sentinel sentinel \
  && chown -R sentinel:sentinel /app

USER sentinel

EXPOSE 8000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD sh -c "curl -f http://localhost:${PORT:-8000}/health || exit 1"

# Gunicorn with Uvicorn workers — workers auto-calculated in gunicorn_conf.py
CMD ["sh", "-c", ".venv/bin/gunicorn src.api.main:app -c gunicorn_conf.py"]

