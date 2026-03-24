#!/bin/bash
# Production startup script for Sentinel Engine
# Supports multiple deployment modes with optimal configuration

set -e

# Environment defaults
export LOG_LEVEL="${LOG_LEVEL:-INFO}"
export PORT="${PORT:-8000}"
export WORKERS="${WORKERS:-}"  # Auto-calculated by gunicorn_conf.py if not set
export RATE_LIMIT_PER_MINUTE="${RATE_LIMIT_PER_MINUTE:-100}"

# Deployment mode: production (gunicorn) or development (uvicorn with reload)
MODE="${MODE:-production}"

echo "Starting Sentinel Engine in ${MODE} mode..."

case "$MODE" in
  production)
    echo "Using Gunicorn with Uvicorn workers (uvloop + httptools enabled)"
    exec .venv/bin/gunicorn src.api.main:app -c gunicorn_conf.py
    ;;

  development)
    echo "Using Uvicorn with hot reload for development"
    exec .venv/bin/uvicorn src.api.main:app \
      --host 0.0.0.0 \
      --port "$PORT" \
      --reload \
      --log-level "${LOG_LEVEL,,}"
    ;;

  single)
    echo "Using single Uvicorn worker with production settings (no gunicorn)"
    exec .venv/bin/uvicorn src.api.main:app \
      --host 0.0.0.0 \
      --port "$PORT" \
      --loop uvloop \
      --http httptools \
      --log-level "${LOG_LEVEL,,}" \
      --no-access-log
    ;;

  *)
    echo "Unknown MODE: $MODE"
    echo "Valid modes: production, development, single"
    exit 1
    ;;
esac
