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
  local verified=""
  local attempt

  # Retry up to 3 times to handle transient API failures.  Without this,
  # a single network blip silently marks a genuinely-verified commit as
  # UNTRUSTED and fails the entire CI run.
  for attempt in 1 2 3; do
    verified="$(
      "$gh_cli" api "repos/${repo}/commits/${sha}" \
        --jq '.commit.verification.verified' 2>/dev/null || true
    )"

    if [[ "$verified" == "true" || "$verified" == "false" ]]; then
      break
    fi

    # Empty / unexpected response — brief pause before retry
    if (( attempt < 3 )); then
      sleep 1
    fi
  done

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

  # Pattern 1: Bot commit via GitHub web-flow (PR merges, Dependabot PRs,
  # Copilot/Codex web-based edits).  The commit is unsigned but the author
  # is a recognised bot and the committer is web-flow.
  if [[ "$committer_login" == "web-flow" &&
        "$committer_email" == "noreply@github.com" &&
        "$author_email" =~ ^[0-9]+\+[^@]+@users\.noreply\.github\.com$ &&
        "$verification_reason" == "unsigned" ]]; then
    return 0
  fi

  # Pattern 2: Bot commit pushed directly by a GitHub Actions workflow
  # (e.g. supabase-typegen auto-commit).  The committer is the same bot
  # (or github-actions[bot]) and the email follows the GitHub noreply
  # pattern.  We still require the author to be a trusted bot.
  if [[ "$committer_email" =~ ^[0-9]+\+[^@]+@users\.noreply\.github\.com$ ||
        "$committer_email" == "noreply@github.com" ]]; then
    is_trusted_login "$committer_login" "$trusted_logins_file" && return 0
  fi

  return 1
}
