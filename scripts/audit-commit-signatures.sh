#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib/commit-signing.sh"

OUTPUT_FILE="${1:-docs/security/commit-signing-exceptions.txt}"
TRUSTED_SIGNERS_FILE="${2:-.github/trusted_signers}"

if [[ ! -f "$TRUSTED_SIGNERS_FILE" ]]; then
  echo "Trusted signers file not found: $TRUSTED_SIGNERS_FILE" >&2
  exit 1
fi

git config gpg.ssh.allowedSignersFile "$TRUSTED_SIGNERS_FILE"

gh_cli=""
repo_slug=""
github_verification_enabled=0

if gh_cli="$(resolve_github_cli 2>/dev/null)" &&
  repo_slug="$(resolve_github_repo 2>/dev/null)" &&
  github_verification_available "$gh_cli"; then
  github_verification_enabled=1
fi

{
  echo "# Legacy commit exceptions (generated $(date -u +%Y-%m-%dT%H:%M:%SZ))"
  echo "# Format: <sha> <status>"
  echo "# Status meanings follow git %G?: G=trusted-good, N=unsigned, E=untrusted/unverifiable, etc."
  while read -r sha status; do
    [[ -z "$sha" ]] && continue

    if [[ "$status" == "G" ]]; then
      continue
    fi

    if [[ "$github_verification_enabled" -eq 1 ]] &&
      is_github_verified_commit "$gh_cli" "$repo_slug" "$sha"; then
      continue
    fi

    echo "$sha $status"
  done < <(git log --all --pretty='%H %G?')
} > "$OUTPUT_FILE"

echo "Wrote $(($(wc -l < "$OUTPUT_FILE") - 3)) legacy exceptions to $OUTPUT_FILE"
