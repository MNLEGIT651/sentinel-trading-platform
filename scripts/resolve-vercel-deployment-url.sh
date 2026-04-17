#!/usr/bin/env bash
set -euo pipefail

# Resolve a Vercel deployment URL from the GitHub Deployments API.
#
# Outputs key=value pairs to stdout (one per line):
#   available=true|false
#   url=<https://...>            (only when available=true)
#   state=success|failure|error|inactive|not_found|api_error|timeout
#   deployment_id=<id>           (when a deployment was located)
#
# Exit codes:
#   0  Always — terminal outcome was reached. Caller must inspect `available`
#      and `state` to decide what to do.
#   2  Usage error (missing args / GITHUB_TOKEN). Nothing written to stdout.
#
# Selection rules:
#   - We always inspect the *latest* deployment for the (sha, environment).
#     GitHub returns deployments in reverse-chronological order. A single SHA
#     can have multiple deployments (e.g. a previous deploy was cancelled,
#     redeployed from the dashboard, or retried by Vercel after a transient
#     failure). Older deployments for the same SHA must not be used for
#     smoke checks because the artifact they point to may be stale or
#     already torn down.
#   - When the latest deployment's status is pending|in_progress|queued, the
#     script polls (sleep, retry) instead of returning a stale older success.
#   - On terminal states success/failure/error/inactive, the script emits
#     them as-is.
#   - Transient API failures (rate limit, 5xx, network) are caught and
#     retried; if every attempt fails we emit state=api_error so callers can
#     decide whether that is a hard failure or an intentional skip.

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
    --repo)          REPO="$2"; shift 2 ;;
    --sha)           SHA="$2"; shift 2 ;;
    --environment)   ENVIRONMENT="$2"; shift 2 ;;
    --attempts)      ATTEMPTS="$2"; shift 2 ;;
    --sleep-seconds) SLEEP_SECONDS="$2"; shift 2 ;;
    -h|--help)       usage; exit 0 ;;
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

# api <path> -> echoes JSON on stdout, returns 0 on success, non-zero on
# transport / HTTP failure. Uses curl --fail-with-body so non-2xx still
# fails clearly without aborting the script (callers wrap with `|| ...`).
api() {
  local path="$1"
  curl --silent --show-error --location --fail-with-body \
    --max-time 15 \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    "https://api.github.com${path}"
}

emit() {
  # All key=value emission goes through here so behaviour is consistent.
  printf '%s\n' "$@"
}

attempt=1
last_api_error=0

while (( attempt <= ATTEMPTS )); do
  # Fetch only the most recent deployment for (sha, environment). per_page=1
  # plus the API's default reverse-chronological ordering guarantees we
  # never pick up a stale earlier deployment of the same SHA.
  deployments_json=""
  if ! deployments_json=$(api "/repos/${REPO}/deployments?sha=${SHA}&environment=${ENVIRONMENT}&per_page=1" 2>/dev/null); then
    last_api_error=1
  else
    last_api_error=0
    deployment_id=$(jq -r '.[0].id // empty' <<<"$deployments_json")

    if [[ -n "$deployment_id" ]]; then
      statuses_json=""
      if ! statuses_json=$(api "/repos/${REPO}/deployments/${deployment_id}/statuses?per_page=1" 2>/dev/null); then
        last_api_error=1
      else
        last_api_error=0
        latest_state=$(jq -r '.[0].state // "unknown"' <<<"$statuses_json")
        latest_url=$(jq -r '.[0].environment_url // ""'  <<<"$statuses_json")

        case "$latest_state" in
          success)
            if [[ -n "$latest_url" ]]; then
              emit "available=true" "url=${latest_url}" "state=success" "deployment_id=${deployment_id}"
              exit 0
            fi
            # Success but no environment_url yet — keep polling.
            ;;
          failure|error|inactive)
            emit "available=false" "state=${latest_state}" "deployment_id=${deployment_id}"
            exit 0
            ;;
          # pending | in_progress | queued | unknown -> fall through and poll
        esac
      fi
    fi
  fi

  if (( attempt < ATTEMPTS )); then
    sleep "$SLEEP_SECONDS"
  fi
  attempt=$((attempt + 1))
done

if (( last_api_error == 1 )); then
  emit "available=false" "state=api_error"
  exit 0
fi

# We reached ATTEMPTS without ever seeing a deployment for this SHA in
# this environment, or the latest one never left pending/in_progress.
if [[ -n "${deployment_id:-}" ]]; then
  emit "available=false" "state=timeout" "deployment_id=${deployment_id}"
else
  emit "available=false" "state=not_found"
fi
exit 0
