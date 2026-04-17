#!/usr/bin/env bash
set -euo pipefail

# Resolve a Vercel deployment URL from GitHub Deployments API.
# Outputs key=value pairs to stdout:
#   available=true|false
#   url=<https://...>
#   state=success|failure|inactive|pending|not_found
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
  curl -fsSL \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    "https://api.github.com${path}"
}

attempt=1
while (( attempt <= ATTEMPTS )); do
  deployments_json=$(api "/repos/${REPO}/deployments?sha=${SHA}&environment=${ENVIRONMENT}&per_page=100")
  deployment_ids=$(jq -r '.[].id' <<<"$deployments_json")

  if [[ -n "$deployment_ids" ]]; then
    while IFS= read -r deployment_id; do
      [[ -z "$deployment_id" ]] && continue
      statuses_json=$(api "/repos/${REPO}/deployments/${deployment_id}/statuses?per_page=20")
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
          echo "available=false"
          echo "state=${latest_state}"
          echo "deployment_id=${deployment_id}"
          exit 0
          ;;
        inactive)
          # Skip/ignored deployment (e.g., vercel ignore command)
          echo "available=false"
          echo "state=inactive"
          echo "deployment_id=${deployment_id}"
          exit 0
          ;;
      esac
    done <<<"$deployment_ids"
  fi

  if (( attempt < ATTEMPTS )); then
    sleep "$SLEEP_SECONDS"
  fi
  attempt=$((attempt + 1))
done

echo "available=false"
echo "state=not_found"
exit 0
