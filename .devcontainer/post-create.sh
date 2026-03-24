#!/usr/bin/env bash
# Sentinel Trading Platform — Codespaces post-create setup
# Runs once after the dev container is built. Installs all workspace
# dependencies so the environment is ready to use immediately.
set -euo pipefail

echo "🛰️  Sentinel Trading Platform — setting up Codespaces environment..."
echo ""

# ── 1. Install pnpm (matches packageManager in root package.json) ───────────
echo "📦 [1/5] Installing pnpm..."
corepack enable
corepack prepare pnpm@10.32.1 --activate
echo "   ✓ pnpm $(pnpm --version) activated"

# ── 2. Install Node workspace dependencies ──────────────────────────────────
echo "📦 [2/5] Installing Node.js workspace dependencies..."
pnpm install --frozen-lockfile
echo "   ✓ Node dependencies installed"

# ── 3. Install Python tooling (uv) and engine dependencies ──────────────────
echo "🐍 [3/5] Installing uv and Python engine dependencies..."
pip install --quiet "uv>=0.5"

cd apps/engine
uv venv .venv
uv pip install --python .venv/bin/python --no-cache ".[dev]"
cd ../..
echo "   ✓ Python engine environment ready"

# ── 4. Copy .env.example → .env if no .env exists ───────────────────────────
if [ ! -f .env ]; then
  echo "📋 [4/5] Copying .env.example → .env (fill in your API keys)"
  cp .env.example .env
  echo "   ✓ .env created from template"
else
  echo "📋 [4/5] .env already exists — skipping"
fi

# ── 5. Prepare git hooks ────────────────────────────────────────────────────
echo "🪝 [5/5] Setting up git hooks..."
pnpm prepare 2>/dev/null || true
echo "   ✓ Git hooks configured"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Codespaces environment ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Fill in API keys in .env (Supabase, Polygon, Alpaca, Anthropic)"
echo "  2. Run 'pnpm dev'            — start all services"
echo "  3. Run 'pnpm test'           — run Node tests"
echo "  4. Run 'pnpm test:engine'    — run Python tests"
echo "  5. See docs/codespaces.md    — full Codespaces guide"
echo ""
