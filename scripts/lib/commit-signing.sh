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

# is_trusted_bot_commit <gh_cli> <repo> <sha> [trusted_bot_logins_file]
#
# Returns 0 (true) when the commit was created by a known trusted bot/service
# account or through GitHub's web-flow.  Matches on:
#   1. committer.login is listed in the trusted_bot_logins file, OR
#   2. commit.committer.email ends with @users.noreply.github.com, OR
#   3. commit.committer.email equals noreply@github.com
#
# Only these explicit patterns are trusted; arbitrary unsigned commits are NOT.
is_trusted_bot_commit() {
  local gh_cli="$1"
  local repo="$2"
  local sha="$3"
  local trusted_logins_file="${4:-.github/trusted_bot_logins}"

  local committer_login committer_email api_response

  api_response="$(
    "$gh_cli" api "repos/${repo}/commits/${sha}" \
      --jq '(.committer.login // "") + "|" + (.commit.committer.email // "")' 2>/dev/null || true
  )"
  committer_login="${api_response%%|*}"
  committer_email="${api_response#*|}"

  # Check committer login against the trusted bot list
  if [[ -f "$trusted_logins_file" && -n "$committer_login" ]]; then
    if grep -Eq "^${committer_login}$" "$trusted_logins_file" 2>/dev/null; then
      return 0
    fi
  fi

  # Check for GitHub noreply email patterns (web-flow / API commits)
  case "$committer_email" in
    noreply@github.com|*@users.noreply.github.com)
      return 0
      ;;
  esac

  return 1
}
