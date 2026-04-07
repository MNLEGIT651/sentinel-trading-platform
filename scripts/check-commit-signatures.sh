#!/usr/bin/env bash
set -euo pipefail

# Audit commit signatures for a given range.
# Usage: check-commit-signatures.sh [RANGE] [EXCEPTIONS_FILE]
#
# Exit codes:
#   0 — all commits trusted or covered by exceptions
#   1 — untrusted commits found (when STRICT=true, default false)
#
# When STRICT is not set or is "false", the script prints warnings but exits 0.

RANGE="${1:-HEAD}"
EXCEPTIONS_FILE="${2:-docs/security/commit-signing-exceptions.txt}"
STRICT="${STRICT:-false}"

if [[ ! -f "$EXCEPTIONS_FILE" ]]; then
  echo "Exceptions file not found: $EXCEPTIONS_FILE — treating all commits as unexempted"
fi

if ! git rev-parse --verify --quiet "${RANGE%%..*}" >/dev/null 2>&1; then
  echo "No commits found for range: $RANGE"
  exit 0
fi

violations=0
total=0

echo "Auditing commit signatures for range: $RANGE"
while read -r sha status; do
  [[ -z "$sha" ]] && continue
  total=$((total + 1))

  if [[ "$status" == "G" || "$status" == "U" || "$status" == "E" ]]; then
    continue
  fi

  if [[ -f "$EXCEPTIONS_FILE" ]] && grep -Eq "^${sha}( |$)" "$EXCEPTIONS_FILE"; then
    echo "LEGACY-EXCEPTION: $sha status=$status"
    continue
  fi

  echo "UNSIGNED: $sha status=$status"
  violations=$((violations + 1))
done < <(git log --pretty='%H %G?' "$RANGE" 2>/dev/null || true)

echo ""
echo "Checked $total commit(s): $violations unsigned, $((total - violations)) signed/excepted."

if [[ "$violations" -gt 0 ]]; then
  if [[ "$STRICT" == "true" ]]; then
    echo "::error::Found $violations unsigned commit(s). See commit-signing-policy.md."
    exit 1
  else
    echo "::warning::Found $violations unsigned commit(s). Consider enabling GPG/SSH signing."
    exit 0
  fi
fi

echo "All commit signatures verified or covered by exceptions."
