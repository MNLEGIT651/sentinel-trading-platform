#!/usr/bin/env bash
set -euo pipefail

# Resolve a Vercel deployment URL from GitHub Deployments API.
# Outputs key=value pairs to stdout:
#   available=true|false
#   url=<https://...>
#   state=success|failure|error|inactive|not_found|api_error
#   deployment_id=<id>

usage() {
  cat <<USAGE
Usage: $(basename "$0") --repo <owner/repo> --sha <commit-sha> --environment <Preview|Production> [--attempts N] [--sleep-seconds N]

Required env:
  GITHUB_TOKEN  GitHub token with deployments:read scope
USAGE
}

REPO=""
SHA=""
ENVIRONMENT=""
ATTEMPTS=20
SLEEP_SECONDS=15

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"; shift 2 ;;
    --sha)
      SHA="$2"; shift 2 ;;
    --environment)
      ENVIRONMENT="$2"; shift 2 ;;
    --attempts)
      ATTEMPTS="$2"; shift 2 ;;
    --sleep-seconds)
      SLEEP_SECONDS="$2"; shift 2 ;;
    -h|--help)
      usage
      exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2 ;;
  esac
done

if [[ -z "$REPO" || -z "$SHA" || -z "$ENVIRONMENT" ]]; then
  echo "Missing required arguments." >&2
  usage >&2
  exit 2
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN is required" >&2
  exit 2
fi

api() {
  local path="$1"
  local tmp http_code response
  tmp=$(mktemp)
  # Use --write-out to capture HTTP code separately; do not use -f so transient
  # HTTP errors don't hard-kill the script under set -euo pipefail.
  if ! http_code=$(curl -sSL \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    --write-out "%{http_code}" \
    --output "$tmp" \
    "https://api.github.com${path}"); then
    rm -f "$tmp"
    return 1
  fi
  response=$(cat "$tmp")
  rm -f "$tmp"
  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    echo "::debug::GitHub API returned HTTP ${http_code} for ${path}" >&2
    return 1
  fi
  echo "$response"
}

attempt=1
while (( attempt <= ATTEMPTS )); do
  # Fetch all deployments for this SHA/environment; treat API failures gracefully.
  if ! deployments_json=$(api "/repos/${REPO}/deployments?sha=${SHA}&environment=${ENVIRONMENT}&per_page=100"); then
    echo "available=false"
    echo "state=api_error"
    exit 0
  fi

  deployment_ids=$(jq -r '.[].id' <<<"$deployments_json")

  if [[ -n "$deployment_ids" ]]; then
    # Single-pass scan: prefer success from any deployment; track best failure.
    # The API returns deployments newest-first, so the first success we encounter
    # is the most recent one.
    best_failure_state=""
    best_failure_id=""
    has_pending=false

    while IFS= read -r deployment_id; do
      [[ -z "$deployment_id" ]] && continue

      if ! statuses_json=$(api "/repos/${REPO}/deployments/${deployment_id}/statuses?per_page=20"); then
        echo "available=false"
        echo "state=api_error"
        exit 0
      fi

      latest_state=$(jq -r '.[0].state // "unknown"' <<<"$statuses_json")
      latest_url=$(jq -r '.[0].environment_url // ""' <<<"$statuses_json")

      case "$latest_state" in
        success)
          if [[ -n "$latest_url" ]]; then
            echo "available=true"
            echo "url=${latest_url}"
            echo "state=success"
            echo "deployment_id=${deployment_id}"
            exit 0
          fi
          ;;
        failure|error)
          # Record but keep scanning; a later (older) deployment may still be active.
          if [[ -z "$best_failure_state" ]]; then
            best_failure_state="${latest_state}"
            best_failure_id="${deployment_id}"
          fi
          ;;
        inactive)
          # vercel ignoreCommand result; record but keep scanning.
          if [[ -z "$best_failure_state" ]]; then
            best_failure_state="inactive"
            best_failure_id="${deployment_id}"
          fi
          ;;
        in_progress|pending|queued|waiting)
          has_pending=true
          ;;
      esac
    done <<<"$deployment_ids"

    # If no success found and nothing is still in-flight, report the best failure.
    if [[ -n "$best_failure_state" && "$has_pending" == false ]]; then
      echo "available=false"
      echo "state=${best_failure_state}"
      echo "deployment_id=${best_failure_id}"
      exit 0
    fi
  fi

  if (( attempt < ATTEMPTS )); then
    sleep "$SLEEP_SECONDS"
  fi
  attempt=$((attempt + 1))
done

echo "available=false"
echo "state=not_found"
exit 0
