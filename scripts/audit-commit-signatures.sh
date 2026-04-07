#!/usr/bin/env bash
set -euo pipefail

OUTPUT_FILE="${1:-docs/security/commit-signing-exceptions.txt}"
TRUSTED_SIGNERS_FILE="${2:-.github/trusted_signers}"

if [[ ! -f "$TRUSTED_SIGNERS_FILE" ]]; then
  echo "Trusted signers file not found: $TRUSTED_SIGNERS_FILE" >&2
  exit 1
fi

git config gpg.ssh.allowedSignersFile "$TRUSTED_SIGNERS_FILE"

{
  echo "# Legacy commit exceptions (generated $(date -u +%Y-%m-%dT%H:%M:%SZ))"
  echo "# Format: <sha> <status>"
  echo "# Status meanings follow git %G?: G=trusted-good, N=unsigned, E=untrusted/unverifiable, etc."
  git log --all --pretty='%H %G?' | awk '$2 != "G" {print $1" "$2}'
} > "$OUTPUT_FILE"

echo "Wrote $(($(wc -l < "$OUTPUT_FILE") - 3)) legacy exceptions to $OUTPUT_FILE"
