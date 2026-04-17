#!/usr/bin/env bash
set -euo pipefail

# Post-deploy health check for Sentinel Trading Platform
# Verifies Vercel frontend, Railway engine/agents, and Supabase are responding.

readonly TIMEOUT=10
readonly RETRIES=2
readonly RETRY_DELAY=3

VERBOSE=false
FAILURES=0

# Service URLs (override via environment variables)
VERCEL_URL="${VERCEL_URL:-https://sentinel-trading-platform.vercel.app}"
ENGINE_HEALTH_URL="${ENGINE_URL:-${VERCEL_URL}/api/engine/health}"
AGENTS_HEALTH_URL="${AGENTS_URL:-${VERCEL_URL}/api/agents/health}"
SUPABASE_API_URL="${SUPABASE_URL:+${SUPABASE_URL}/rest/v1/}"

# Vercel Protection Bypass for Automation header (set VERCEL_BYPASS_SECRET in CI).
# Allows smoke checks to probe password-protected preview deployments.
BYPASS_ARGS=()
if [[ -n "${VERCEL_BYPASS_SECRET:-}" ]]; then
  BYPASS_ARGS=(-H "x-vercel-protection-bypass: ${VERCEL_BYPASS_SECRET}")
fi

# --- helpers ----------------------------------------------------------------

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Verify all Sentinel services are healthy after deployment.

Options:
  --verbose, -v   Show detailed output for each check
  --help, -h      Show this help message

Environment variables:
  ENGINE_URL      Override Railway engine health endpoint
  AGENTS_URL      Override Railway agents health endpoint
  SUPABASE_URL    Override Supabase API endpoint
EOF
}

log_verbose() {
  if [[ "$VERBOSE" == true ]]; then
    printf "  %s\n" "$*"
  fi
}

check_service() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local attempt=0
  local status_code=""
  local body=""

  while (( attempt <= RETRIES )); do
    if (( attempt > 0 )); then
      log_verbose "Retry ${attempt}/${RETRIES} after ${RETRY_DELAY}s..."
      sleep "$RETRY_DELAY"
    fi

    log_verbose "Checking ${url} (timeout ${TIMEOUT}s)..."

    # Capture both status code and body; allow curl to fail without killing the script
    local http_response
    http_response=$(curl --silent --max-time "$TIMEOUT" "${BYPASS_ARGS[@]+"${BYPASS_ARGS[@]}"}" --write-out "\n%{http_code}" "$url" 2>&1) || true

    status_code=$(echo "$http_response" | tail -n1)
    body=$(echo "$http_response" | sed '$d')

    log_verbose "HTTP status: ${status_code}"

    if [[ "$status_code" == "$expected_status" ]]; then
      log_verbose "Response OK"
      return 0
    fi

    (( attempt++ ))
  done

  log_verbose "Expected ${expected_status}, got ${status_code}"
  if [[ "$VERBOSE" == true && -n "$body" ]]; then
    printf "  Response body (truncated):\n  %.200s\n" "$body"
  fi
  return 1
}

# --- parse args --------------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --verbose|-v) VERBOSE=true ;;
    --help|-h)    usage; exit 0 ;;
    *)
      printf "Unknown option: %s\n" "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

# --- run checks --------------------------------------------------------------

printf "🔍 Sentinel post-deploy health check\n"
printf "════════════════════════════════════════\n\n"

declare -A RESULTS

run_check() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"

  printf "Checking %-30s " "${label}..."
  if check_service "$label" "$url" "$expected"; then
    RESULTS["$label"]="pass"
    printf "✓ UP\n"
  else
    RESULTS["$label"]="fail"
    FAILURES=$((FAILURES + 1))
    printf "✗ DOWN\n"
  fi
}

run_check "Vercel Frontend"    "$VERCEL_URL"
run_check "Railway Engine"     "$ENGINE_HEALTH_URL"
run_check "Railway Agents"     "$AGENTS_HEALTH_URL"
if [[ -n "$SUPABASE_API_URL" ]]; then
  run_check "Supabase API"     "$SUPABASE_API_URL"
else
  printf "  ⊘  Supabase API (skipped — SUPABASE_URL not set)\n"
fi

# --- summary -----------------------------------------------------------------

printf "\n════════════════════════════════════════\n"
printf "Summary:\n\n"

for svc in "Vercel Frontend" "Railway Engine" "Railway Agents"; do
  if [[ "${RESULTS[$svc]}" == "pass" ]]; then
    printf "  ✓  %s\n" "$svc"
  else
    printf "  ✗  %s\n" "$svc"
  fi
done
if [[ -n "$SUPABASE_API_URL" ]]; then
  if [[ "${RESULTS[Supabase API]}" == "pass" ]]; then
    printf "  ✓  Supabase API\n"
  else
    printf "  ✗  Supabase API\n"
  fi
else
  printf "  ⊘  Supabase API (skipped)\n"
fi

printf "\n"

if (( FAILURES == 0 )); then
  printf "✅ All services healthy — deploy looks good!\n"
  exit 0
else
  printf "❌ %d service(s) failed — investigate before proceeding.\n" "$FAILURES"
  exit 1
fi
