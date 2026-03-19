# ─── Sentinel Engine — Python FastAPI ────────────────────────────────────────
FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "uv>=0.5"

# ─── Dependencies layer ───────────────────────────────────────────────────────
FROM base AS deps

COPY apps/engine/pyproject.toml ./

RUN uv venv .venv \
  && uv pip install --python .venv/bin/python --no-cache "."

# ─── Runtime image ────────────────────────────────────────────────────────────
FROM base AS runner

WORKDIR /app

COPY --from=deps /app/.venv ./.venv
COPY apps/engine/src ./src
COPY apps/engine/pyproject.toml ./

RUN addgroup --system --gid 1001 sentinel \
  && adduser --system --uid 1001 --ingroup sentinel sentinel
USER sentinel

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD [".venv/bin/uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
