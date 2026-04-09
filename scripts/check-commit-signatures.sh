#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/lib/commit-signing.sh"

RANGE="${1:-}"
EXCEPTIONS_FILE="${2:-docs/security/commit-signing-exceptions.txt}"
TRUSTED_SIGNERS_FILE="${3:-.github/trusted_signers}"
TRUSTED_BOT_LOGINS_FILE="${4:-.github/trusted_bot_logins}"

if [[ ! -f "$TRUSTED_SIGNERS_FILE" ]]; then
  echo "Trusted signers file not found: $TRUSTED_SIGNERS_FILE" >&2
  exit 1
fi

if [[ ! -f "$EXCEPTIONS_FILE" ]]; then
  echo "Exceptions file not found: $EXCEPTIONS_FILE" >&2
  exit 1
fi

git config gpg.ssh.allowedSignersFile "$TRUSTED_SIGNERS_FILE"

if [[ -z "$RANGE" ]]; then
  RANGE="HEAD"
fi

if ! git rev-parse --verify --quiet "${RANGE%%..*}" >/dev/null; then
  echo "No commits found for range: $RANGE"
  exit 0
fi

violations=0
gh_cli=""
repo_slug=""
github_verification_enabled=0

if gh_cli="$(resolve_github_cli 2>/dev/null)" &&
  repo_slug="$(resolve_github_repo 2>/dev/null)" &&
  github_verification_available "$gh_cli"; then
  github_verification_enabled=1
fi

echo "Auditing commit signatures for range: $RANGE"
while read -r sha status; do
  [[ -z "$sha" ]] && continue

  if [[ "$status" == "G" ]]; then
    continue
  fi

  if grep -Eq "^${sha}( |$)" "$EXCEPTIONS_FILE"; then
    echo "LEGACY-EXCEPTION: $sha status=$status"
    continue
  fi

  if [[ "$github_verification_enabled" -eq 1 ]] &&
    is_github_verified_commit "$gh_cli" "$repo_slug" "$sha"; then
    echo "GITHUB-VERIFIED: $sha status=$status"
    continue
  fi

  if [[ "$github_verification_enabled" -eq 1 ]] &&
    is_trusted_bot_commit "$gh_cli" "$repo_slug" "$sha" "$TRUSTED_BOT_LOGINS_FILE"; then
    echo "TRUSTED-BOT: $sha status=$status"
    continue
  fi

  echo "UNTRUSTED: $sha status=$status"
  violations=$((violations + 1))
done < <(git log --pretty='%H %G?' "$RANGE")

if [[ "$violations" -gt 0 ]]; then
  echo "Found $violations untrusted commit signature(s)."
  exit 1
fi

echo "All commit signatures trusted, GitHub-verified, or covered by legacy exceptions."
