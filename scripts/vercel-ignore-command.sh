#!/usr/bin/env bash
set -euo pipefail

# Vercel ignore command contract:
# - Exit 0 => skip build
# - Exit 1 => run build
#
# We run from apps/web via vercel.json and move to repo root.
cd "$(dirname "$0")/.."

TARGETS=(
  "apps/web/"
  "packages/shared/"
)

DEFAULT_BRANCH="${VERCEL_GIT_COMMIT_REF:-main}"
REMOTE_BASE="origin/${DEFAULT_BRANCH}"

# In shallow/non-standard clones, origin/<branch> may not exist.
# Fall back to previous commit, then to root commit.
if git rev-parse --verify -q "$REMOTE_BASE" >/dev/null; then
  BASE="$(git merge-base HEAD "$REMOTE_BASE")"
elif git rev-parse --verify -q HEAD^ >/dev/null; then
  BASE="$(git rev-parse HEAD^)"
else
  BASE="$(git rev-list --max-parents=0 HEAD | tail -n 1)"
fi

if git diff --quiet "$BASE" HEAD -- "${TARGETS[@]}"; then
  echo "No web/shared changes since ${BASE}; skipping Vercel build."
  exit 0
fi

echo "Detected web/shared changes since ${BASE}; running Vercel build."
exit 1
