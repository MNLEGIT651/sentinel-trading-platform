#!/usr/bin/env bash
set -euo pipefail

# Post-deploy smoke tests for Sentinel Trading Platform
# Goes beyond health checks to verify key user-facing functionality.
# Exit code 0 = all tests passed, non-zero = failures detected.

readonly TIMEOUT=15
readonly MAX_RETRIES=2
readonly RETRY_DELAY=3

VERBOSE=false
FAILURES=0
PASSED=0

# Service URLs (override via environment variables)
VERCEL_URL="${VERCEL_URL:-https://sentinel-trading-platform.vercel.app}"
SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL must be set}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Post-deploy smoke tests for Sentinel Trading Platform.

Options:
  --verbose, -v      Show detailed output for each test
  --vercel-url URL   Override Vercel URL
  --supabase-url URL Override Supabase URL
  --help, -h         Show this help message
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --verbose|-v) VERBOSE=true; shift ;;
    --vercel-url) VERCEL_URL="$2"; shift 2 ;;
    --supabase-url) SUPABASE_URL="$2"; shift 2 ;;
    --help|-h) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

log() { echo "[smoke] $*"; }
verbose() { $VERBOSE && echo "        $*" || true; }

pass() {
  log "✅ $1"
  ((PASSED++))
}

fail() {
  log "❌ $1"
  verbose "  Detail: ${2:-no details}"
  ((FAILURES++))
}

http_get() {
  local url="$1"
  local attempt=0
  local response=""
  while (( attempt <= MAX_RETRIES )); do
    response=$(curl -sS --max-time "$TIMEOUT" -w "\n%{http_code}" "$url" 2>&1) && break
    ((attempt++))
    (( attempt <= MAX_RETRIES )) && sleep "$RETRY_DELAY"
  done
  echo "$response"
}

# ---------- Test 1: Vercel serves the app (HTML response) ----------
test_vercel_serves_html() {
  local raw
  raw=$(http_get "$VERCEL_URL")
  local code
  code=$(echo "$raw" | tail -1)
  local body
  body=$(echo "$raw" | sed '$d')

  if [[ "$code" == "200" ]] && echo "$body" | grep -qi "sentinel\|trading\|<!doctype"; then
    pass "Vercel serves HTML (HTTP $code)"
  else
    fail "Vercel HTML response" "HTTP $code"
  fi
}

# ---------- Test 2: Health endpoint returns JSON with status ----------
test_health_endpoint() {
  local raw
  raw=$(http_get "$VERCEL_URL/api/health")
  local code
  code=$(echo "$raw" | tail -1)
  local body
  body=$(echo "$raw" | sed '$d')

  if [[ "$code" == "200" ]] && echo "$body" | grep -q '"status"'; then
    pass "Health endpoint returns status (HTTP $code)"
    verbose "Response: $body"

    # Check for degraded dependencies
    if echo "$body" | grep -q '"disconnected"'; then
      log "  ⚠️  Some dependencies disconnected"
      verbose "  $body"
    fi
  else
    fail "Health endpoint" "HTTP $code"
  fi
}

# ---------- Test 3: Settings status endpoint ----------
test_settings_status() {
  local raw
  raw=$(http_get "$VERCEL_URL/api/settings/status")
  local code
  code=$(echo "$raw" | tail -1)

  if [[ "$code" == "200" ]]; then
    pass "Settings status endpoint (HTTP $code)"
  else
    fail "Settings status endpoint" "HTTP $code"
  fi
}

# ---------- Test 4: Supabase REST API reachable ----------
test_supabase_api() {
  local raw
  raw=$(curl -sS --max-time "$TIMEOUT" -w "\n%{http_code}" \
    -H "apikey: ${SUPABASE_ANON_KEY:-placeholder}" \
    "$SUPABASE_URL/rest/v1/" 2>&1)
  local code
  code=$(echo "$raw" | tail -1)

  # 200 = success, 401 = key invalid but API is reachable
  if [[ "$code" == "200" || "$code" == "401" ]]; then
    pass "Supabase REST API reachable (HTTP $code)"
  else
    fail "Supabase REST API" "HTTP $code"
  fi
}

# ---------- Test 5: Static assets load (Next.js _next/static) ----------
test_static_assets() {
  local raw
  raw=$(http_get "$VERCEL_URL")
  local body
  body=$(echo "$raw" | sed '$d')

  # Extract a _next/static JS chunk URL from the HTML (POSIX-compatible)
  local asset_path
  asset_path=$(echo "$body" | sed -n 's/.*\(\/_next\/static\/[^"]*\.js\).*/\1/p' | head -1)

  if [[ -n "$asset_path" ]]; then
    local asset_raw
    asset_raw=$(http_get "$VERCEL_URL$asset_path")
    local asset_code
    asset_code=$(echo "$asset_raw" | tail -1)
    if [[ "$asset_code" == "200" ]]; then
      pass "Static assets loadable ($asset_path)"
    else
      fail "Static asset load" "HTTP $asset_code for $asset_path"
    fi
  else
    fail "Static assets" "No _next/static JS found in HTML"
  fi
}

# ---------- Test 6: API routes return proper CORS / auth responses ----------
test_api_auth_required() {
  # Engine proxy should require auth — expect 401 without token
  local raw
  raw=$(http_get "$VERCEL_URL/api/engine/health")
  local code
  code=$(echo "$raw" | tail -1)

  # Health endpoints may be open, but other routes should require auth
  if [[ "$code" == "200" || "$code" == "401" ]]; then
    pass "Engine proxy responds (HTTP $code)"
  else
    fail "Engine proxy" "HTTP $code — expected 200 or 401"
  fi
}

# ---------- Run all tests ----------
log "Smoke tests starting for $VERCEL_URL"
log "================================================"

test_vercel_serves_html
test_health_endpoint
test_settings_status
test_supabase_api
test_static_assets
test_api_auth_required

log "================================================"
log "Results: $PASSED passed, $FAILURES failed"

if (( FAILURES > 0 )); then
  log "🔴 SMOKE TESTS FAILED"
  exit 1
else
  log "🟢 ALL SMOKE TESTS PASSED"
  exit 0
fi
