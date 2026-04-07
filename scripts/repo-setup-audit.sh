#!/usr/bin/env bash
set -euo pipefail

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf "✅ %s\n" "$1"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf "⚠️  %s\n" "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf "❌ %s\n" "$1"
}

check_file() {
  local path="$1"
  if [[ -e "$path" ]]; then
    pass "Found ${path}"
  else
    fail "Missing ${path}"
  fi
}

printf "🔎 Sentinel repository setup audit\n"
printf "=================================\n"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Current directory is not inside a git repository"
  exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
  origin_url="$(git remote get-url origin)"
  pass "origin remote configured (${origin_url})"
else
  fail "origin remote is not configured"
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ -n "$current_branch" ]]; then
  pass "Current branch detected (${current_branch})"
else
  fail "Unable to determine current branch"
fi

if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  upstream_branch="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}')"
  pass "Current branch tracks upstream (${upstream_branch})"
else
  warn "Current branch has no upstream tracking branch"
fi

if git fetch --all --prune >/dev/null 2>&1; then
  pass "git fetch --all --prune completed"
else
  warn "git fetch --all --prune failed (check network/auth)"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  warn "Working tree has uncommitted changes"
else
  pass "Working tree is clean"
fi

printf "\n📄 Required repository files\n"
printf '%s\n' "---------------------------"
check_file "README.md"
check_file "LICENSE"
check_file "CONTRIBUTING.md"
check_file "SECURITY.md"
check_file "CODE_OF_CONDUCT.md"
check_file ".gitignore"
check_file ".editorconfig"
check_file ".gitattributes"

printf "\n🐙 GitHub collaboration files\n"
printf '%s\n' "-----------------------------"
check_file ".github/workflows"
check_file ".github/CODEOWNERS"
check_file ".github/PULL_REQUEST_TEMPLATE.md"
check_file ".github/ISSUE_TEMPLATE"

printf "\nSummary: %d passed, %d warnings, %d failed\n" "$PASS_COUNT" "$WARN_COUNT" "$FAIL_COUNT"

if (( FAIL_COUNT > 0 )); then
  exit 1
fi

exit 0
