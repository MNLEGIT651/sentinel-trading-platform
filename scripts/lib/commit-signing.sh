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

is_trusted_login() {
  local login="$1"
  local trusted_logins_file="$2"

  [[ -n "$login" && -f "$trusted_logins_file" ]] || return 1

  while IFS= read -r candidate || [[ -n "$candidate" ]]; do
    candidate="${candidate%%#*}"
    candidate="${candidate#"${candidate%%[![:space:]]*}"}"
    candidate="${candidate%"${candidate##*[![:space:]]}"}"
    [[ -n "$candidate" ]] || continue
    [[ "$candidate" == "$login" ]] && return 0
  done <"$trusted_logins_file"

  return 1
}

is_trusted_bot_commit() {
  local gh_cli="$1"
  local repo="$2"
  local sha="$3"
  local trusted_logins_file="$4"
  local commit_data
  local author_login
  local author_type
  local author_email
  local committer_login
  local committer_email
  local verification_reason

  [[ -f "$trusted_logins_file" ]] || return 1

  commit_data="$(
    "$gh_cli" api "repos/${repo}/commits/${sha}" \
      --jq '[.author.login // "", .author.type // "", .commit.author.email // "", .committer.login // "", .commit.committer.email // "", .commit.verification.reason // ""] | @tsv' \
      2>/dev/null || true
  )"

  [[ -n "$commit_data" ]] || return 1

  IFS=$'\t' read -r author_login author_type author_email committer_login committer_email verification_reason <<<"$commit_data"

  [[ "$author_type" == "Bot" ]] || return 1
  is_trusted_login "$author_login" "$trusted_logins_file" || return 1
  [[ "$committer_login" == "web-flow" ]] || return 1
  [[ "$committer_email" == "noreply@github.com" ]] || return 1
  [[ "$author_email" =~ ^[0-9]+\+[^@]+@users\.noreply\.github\.com$ ]] || return 1
  [[ "$verification_reason" == "unsigned" ]] || return 1
}
