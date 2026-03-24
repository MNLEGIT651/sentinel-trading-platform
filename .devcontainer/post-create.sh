#!/usr/bin/env bash
# Sentinel Trading Platform — Codespaces post-create setup
# Runs once after the dev container is built. Installs all workspace
# dependencies so the environment is ready to use immediately.
set -euo pipefail

echo "🛰️  Sentinel Trading Platform — setting up Codespaces environment..."

# ── 1. Install pnpm (matches packageManager in root package.json) ───────────
echo "📦 Installing pnpm..."
corepack enable
corepack prepare pnpm@10.32.1 --activate

# ── 2. Install Node workspace dependencies ──────────────────────────────────
echo "📦 Installing Node.js workspace dependencies..."
pnpm install --frozen-lockfile

# ── 3. Install Python tooling (uv) and engine dependencies ──────────────────
echo "🐍 Installing uv and Python engine dependencies..."
pip install --quiet "uv>=0.5"

cd apps/engine
uv venv .venv
uv pip install --python .venv/bin/python --no-cache ".[dev]"
cd ../..

# ── 4. Copy .env.example → .env if no .env exists ───────────────────────────
if [ ! -f .env ]; then
  echo "📋 Copying .env.example → .env (fill in your API keys)"
  cp .env.example .env
fi

# ── 5. Prepare git hooks ────────────────────────────────────────────────────
echo "🪝 Setting up git hooks..."
pnpm prepare 2>/dev/null || true

echo ""
echo "✅ Codespaces environment ready!"
echo ""
echo "Next steps:"
echo "  1. Fill in API keys in .env (Supabase, Polygon, Alpaca, Anthropic)"
echo "  2. Run 'pnpm dev'            — start all services"
echo "  3. Run 'pnpm test'           — run Node tests"
echo "  4. Run 'pnpm test:engine'    — run Python tests"
echo "  5. See docs/codespaces.md    — full Codespaces guide"
