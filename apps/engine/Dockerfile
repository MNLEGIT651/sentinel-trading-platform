# ─── Sentinel Engine — Python FastAPI ────────────────────────────────────────
# Multi-stage production-optimized Dockerfile following 2026 best practices
# - Uses Python 3.12 for performance and modern features
# - Leverages uv for fast dependency installation
# - Runs with Gunicorn + Uvicorn workers for production-grade async serving
# - Includes uvloop and httptools for 2-4x performance improvement
# - Non-root user for security
# - Health checks for orchestration platforms

FROM python:3.12-slim AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# Install uv package manager (pinned to CI version)
RUN pip install --no-cache-dir "uv==0.11.5"

# ─── Dependencies layer ───────────────────────────────────────────────────────
FROM base AS deps

COPY pyproject.toml uv.lock ./

# Create venv and install production dependencies only
RUN uv venv .venv \
  && uv sync --locked --no-dev --no-install-project --python .venv/bin/python

# ─── Runtime image ────────────────────────────────────────────────────────────
FROM base AS runner

WORKDIR /app

# Copy virtual environment from deps stage
COPY --from=deps /app/.venv ./.venv

# Put venv on PATH so gunicorn/uvicorn are directly invocable
ENV PATH="/app/.venv/bin:$PATH"

# Copy application code
COPY src ./src
COPY gunicorn_conf.py start.sh ./
RUN chmod +x start.sh

# Create non-root user for security
RUN addgroup --system --gid 1001 sentinel \
  && adduser --system --uid 1001 --ingroup sentinel sentinel

# Set ownership
RUN chown -R sentinel:sentinel /app

USER sentinel

EXPOSE 8000

# Health check for container orchestration (shell form for PORT variable)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD sh -c "curl -f http://localhost:${PORT:-8000}/ready || exit 1"

# Exec form: signals propagate directly to gunicorn (no shell wrapper)
CMD ["gunicorn", "src.api.main:app", "-c", "gunicorn_conf.py"]
