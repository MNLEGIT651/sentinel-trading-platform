#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Sentinel Trading Platform — Deployment Cleanup Script
#
# Deactivates stale GitHub deployments and removes orphaned
# environments. Requires a GitHub token with repo_deployment
# and environment scopes.
#
# Usage:
#   ./scripts/cleanup-deployments.sh                 # dry-run
#   ./scripts/cleanup-deployments.sh --apply         # execute
#   ./scripts/cleanup-deployments.sh --max-age 14    # 14-day cutoff
# ─────────────────────────────────────────────────────────────

REPO="${GITHUB_REPOSITORY:-stevenschling13/Trading-App}"
TOKEN="${GITHUB_TOKEN:-}"
MAX_AGE_DAYS=30
DRY_RUN=true
API="https://api.github.com"

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --apply           Actually deactivate deployments (default: dry-run)
  --max-age DAYS    Deactivate deployments older than DAYS (default: 30)
  --repo OWNER/REPO Override target repository
  --help            Show this help

Environment:
  GITHUB_TOKEN      Required. Personal access token with repo_deployment scope.
  GITHUB_REPOSITORY Optional. Defaults to stevenschling13/Trading-App.
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) DRY_RUN=false; shift ;;
    --max-age) MAX_AGE_DAYS="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --help) usage ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$TOKEN" ]]; then
  echo "Error: GITHUB_TOKEN is required." >&2
  echo "Create one at https://github.com/settings/tokens with 'repo' scope." >&2
  exit 1
fi

gh_api() {
  local method="$1" endpoint="$2"
  shift 2
  curl -fsSL \
    -X "$method" \
    -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$@" \
    "$API/repos/$REPO$endpoint"
}

cutoff_date=$(date -u -d "$MAX_AGE_DAYS days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || \
              date -u -v-"${MAX_AGE_DAYS}d" +%Y-%m-%dT%H:%M:%SZ)

echo "╔════════════════════════════════════════════════════╗"
echo "║   Sentinel Deployment Cleanup                     ║"
echo "╠════════════════════════════════════════════════════╣"
echo "║  Repo:     $REPO"
echo "║  Max age:  $MAX_AGE_DAYS days (before $cutoff_date)"
echo "║  Mode:     $(if $DRY_RUN; then echo 'DRY RUN'; else echo 'APPLYING CHANGES'; fi)"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# ── 1. List environments ──────────────────────────────────

echo "── Environments ──"
environments=$(gh_api GET /environments | python3 -c "
import sys, json
data = json.load(sys.stdin)
for env in data.get('environments', []):
    print(env['name'])
" 2>/dev/null || echo "")

if [[ -z "$environments" ]]; then
  echo "  No environments found (or API error)."
else
  echo "$environments" | while read -r env; do
    echo "  • $env"
  done
fi
echo ""

# ── 2. Remove orphaned environments ──────────────────────

ORPHANED_ENVS=("github-pages")
echo "── Orphaned Environment Cleanup ──"
for env in "${ORPHANED_ENVS[@]}"; do
  if echo "$environments" | grep -qx "$env"; then
    if $DRY_RUN; then
      echo "  [DRY RUN] Would delete environment: $env"
    else
      echo "  Deleting environment: $env"
      gh_api DELETE "/environments/$env" || echo "  ⚠ Failed to delete $env"
    fi
  else
    echo "  ✓ $env does not exist (already clean)"
  fi
done
echo ""

# ── 3. Deactivate stale deployments ──────────────────────

echo "── Stale Deployment Cleanup ──"
page=1
total=0
deactivated=0
skipped=0

while true; do
  deployments=$(gh_api GET "/deployments?per_page=100&page=$page")
  count=$(echo "$deployments" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")

  if [[ "$count" == "0" ]]; then
    break
  fi

  results=$(echo "$deployments" | python3 -c "
import sys, json
from datetime import datetime

cutoff = '$cutoff_date'
data = json.load(sys.stdin)
for d in data:
    created = d['created_at']
    env = d.get('environment', 'unknown')
    dep_id = d['id']
    ref = d.get('ref', 'unknown')
    is_old = created < cutoff
    print(f'{dep_id}|{env}|{ref}|{created}|{is_old}')
")

  while IFS='|' read -r dep_id env ref created is_old; do
    total=$((total + 1))
    if [[ "$is_old" == "True" ]]; then
      if $DRY_RUN; then
        echo "  [DRY RUN] Would deactivate: #$dep_id ($env, ref=$ref, created=$created)"
      else
        gh_api POST "/deployments/$dep_id/statuses" \
          -d '{"state":"inactive","description":"Cleaned up by deployment cleanup script"}' > /dev/null
        echo "  ✓ Deactivated: #$dep_id ($env, ref=$ref)"
      fi
      deactivated=$((deactivated + 1))
    else
      skipped=$((skipped + 1))
    fi
  done <<< "$results"

  if [[ "$count" -lt 100 ]]; then
    break
  fi
  page=$((page + 1))
done

echo ""
echo "── Summary ──"
echo "  Total deployments scanned: $total"
echo "  Stale (would deactivate):  $deactivated"
echo "  Recent (kept):             $skipped"

if $DRY_RUN && [[ $deactivated -gt 0 ]]; then
  echo ""
  echo "  Run with --apply to execute these changes."
fi

echo ""
echo "Done."
