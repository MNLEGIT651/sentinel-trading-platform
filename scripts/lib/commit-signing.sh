#!/usr/bin/env bash

resolve_github_cli() {
  if command -v gh >/dev/null 2>&1; then
    printf '%s\n' "gh"
    return 0
  fi

  if command -v gh.exe >/dev/null 2>&1; then
    printf '%s\n' "gh.exe"
    return 0
  fi

  return 1
}

resolve_github_repo() {
  if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
    printf '%s\n' "$GITHUB_REPOSITORY"
    return 0
  fi

  local remote_url
  remote_url="$(git remote get-url origin 2>/dev/null || true)"
  remote_url="${remote_url%.git}"

  case "$remote_url" in
    git@github.com:*)
      printf '%s\n' "${remote_url#git@github.com:}"
      ;;
    ssh://git@github.com/*)
      printf '%s\n' "${remote_url#ssh://git@github.com/}"
      ;;
    https://github.com/*)
      printf '%s\n' "${remote_url#https://github.com/}"
      ;;
    *)
      return 1
      ;;
  esac
}

github_verification_available() {
  local gh_cli="${1:-}"

  if [[ -z "$gh_cli" ]]; then
    gh_cli="$(resolve_github_cli)" || return 1
  fi

  if [[ -n "${GH_TOKEN:-}" || -n "${GITHUB_TOKEN:-}" ]]; then
    return 0
  fi

  "$gh_cli" auth status >/dev/null 2>&1
}

is_github_verified_commit() {
  local gh_cli="$1"
  local repo="$2"
  local sha="$3"
  local verified

  verified="$(
    "$gh_cli" api "repos/${repo}/commits/${sha}" \
      --jq '.commit.verification.verified' 2>/dev/null || true
  )"

  [[ "$verified" == "true" ]]
}
