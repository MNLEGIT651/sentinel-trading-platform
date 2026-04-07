#!/usr/bin/env bash
set -euo pipefail

# Vercel ignore command:
# exit 0 -> skip build
# exit non-zero -> run build

TARGET="${VERCEL_GIT_COMMIT_SHA:-HEAD}"
BASE="${VERCEL_GIT_PREVIOUS_COMMIT:-}"

if [[ -z "${BASE}" ]]; then
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    BASE="$(git merge-base "${TARGET}" origin/main || true)"
  fi
fi

if [[ -z "${BASE}" ]]; then
  if git rev-parse --verify "${TARGET}^" >/dev/null 2>&1; then
    BASE="$(git rev-parse "${TARGET}^")"
  fi
fi

if [[ -z "${BASE}" ]]; then
  echo "No base commit detected; running build."
  exit 1
fi

if git diff --quiet "${BASE}" "${TARGET}" -- apps/web packages/shared; then
  echo "No web/shared changes since ${BASE}; skipping build."
  exit 0
fi

echo "Changes detected in web/shared; running build."
exit 1
