#!/usr/bin/env bash
# Agent Worktree Manager
#
# Creates isolated Git worktrees for parallel agent work.
# Each agent works in its own directory with its own branch,
# preventing index.lock conflicts and file collisions.
#
# Usage:
#   ./scripts/agent-worktree.sh create <branch-name> [agent-name]
#   ./scripts/agent-worktree.sh list
#   ./scripts/agent-worktree.sh remove <branch-name>
#   ./scripts/agent-worktree.sh clean
#
# Examples:
#   ./scripts/agent-worktree.sh create feat/add-auth claude
#   ./scripts/agent-worktree.sh create fix/nav-bug codex
#   ./scripts/agent-worktree.sh list
#   ./scripts/agent-worktree.sh remove feat/add-auth

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Error: Not inside a git repository" >&2
  exit 1
}

WORKTREE_DIR="${REPO_ROOT}/.worktrees"

usage() {
  cat <<'EOF'
Agent Worktree Manager — Isolated workspaces for parallel agents

Commands:
  create <branch> [agent]  Create a worktree branching from current main
  list                     Show all active worktrees with status
  remove <branch>          Remove a worktree and optionally its branch
  clean                    Remove all worktrees whose branches are merged

Options:
  --help, -h               Show this help

Rules:
  • One branch per agent session — never share worktrees
  • Always run `pnpm install` inside a new worktree
  • Always run `pnpm pre-pr` before pushing from a worktree
  • Delete worktrees after merging
EOF
}

cmd_create() {
  local branch="${1:-}"
  local agent="${2:-unknown}"

  if [[ -z "$branch" ]]; then
    echo "Error: branch name required" >&2
    echo "Usage: $0 create <branch-name> [agent-name]" >&2
    exit 1
  fi

  # Ensure branch name follows convention
  if [[ ! "$branch" =~ ^(feat|fix|chore|refactor|docs|test|ci)/ ]]; then
    echo "Warning: Branch name should follow convention: feat/, fix/, chore/, etc."
  fi

  local worktree_path="${WORKTREE_DIR}/${branch//\//-}"

  # Fetch latest main
  echo "📥 Fetching latest main..."
  git fetch origin main --quiet

  # Create worktree
  echo "🌳 Creating worktree at: ${worktree_path}"
  mkdir -p "$WORKTREE_DIR"

  if git show-ref --verify --quiet "refs/heads/${branch}"; then
    echo "  Branch '${branch}' already exists — using it"
    git worktree add "$worktree_path" "$branch"
  else
    echo "  Creating new branch '${branch}' from origin/main"
    git worktree add -b "$branch" "$worktree_path" origin/main
  fi

  # Write metadata
  cat > "${worktree_path}/.worktree-meta.json" <<EOFMETA
{
  "agent": "${agent}",
  "branch": "${branch}",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "parentMain": "$(git rev-parse origin/main)"
}
EOFMETA

  # Install dependencies
  echo "📦 Installing dependencies..."
  (cd "$worktree_path" && pnpm install --frozen-lockfile 2>/dev/null) || {
    echo "Warning: pnpm install had issues — you may need to run it manually"
  }

  echo ""
  echo "✅ Worktree ready!"
  echo ""
  echo "  Path:   ${worktree_path}"
  echo "  Branch: ${branch}"
  echo "  Agent:  ${agent}"
  echo ""
  echo "  cd ${worktree_path}"
  echo ""
  echo "When done:"
  echo "  1. Run: pnpm pre-pr           (validate before PR)"
  echo "  2. Run: git push -u origin ${branch}"
  echo "  3. Run: gh pr create --fill"
  echo "  4. Run: $0 remove ${branch}   (cleanup)"
}

cmd_list() {
  echo "🌳 Active worktrees:"
  echo ""

  local count=0
  if git worktree list --porcelain | grep -q "^worktree "; then
    git worktree list --porcelain | while IFS= read -r line; do
      case "$line" in
        "worktree "*)
          local path="${line#worktree }"
          if [[ "$path" == "$REPO_ROOT" ]]; then
            continue
          fi

          local meta_file="${path}/.worktree-meta.json"
          local agent="unknown"
          local created="unknown"

          if [[ -f "$meta_file" ]]; then
            agent=$(grep -o '"agent": "[^"]*"' "$meta_file" | cut -d'"' -f4 || echo "unknown")
            created=$(grep -o '"created": "[^"]*"' "$meta_file" | cut -d'"' -f4 || echo "unknown")
          fi
          ;;
        "branch refs/heads/"*)
          local branch="${line#branch refs/heads/}"
          echo "  📂 ${path}"
          echo "     Branch:  ${branch}"
          echo "     Agent:   ${agent}"
          echo "     Created: ${created}"

          # Check staleness
          local behind=$(git rev-list --count "${branch}..origin/main" 2>/dev/null || echo "?")
          echo "     Behind main: ${behind} commits"
          echo ""
          count=$((count + 1))
          ;;
      esac
    done
  fi

  if [[ $count -eq 0 ]]; then
    echo "  No active worktrees (besides main)"
    echo ""
    echo "  Create one: $0 create <branch-name> [agent-name]"
  fi
}

cmd_remove() {
  local branch="${1:-}"
  if [[ -z "$branch" ]]; then
    echo "Error: branch name required" >&2
    exit 1
  fi

  local worktree_path="${WORKTREE_DIR}/${branch//\//-}"

  if [[ ! -d "$worktree_path" ]]; then
    echo "Error: No worktree found at ${worktree_path}" >&2
    exit 1
  fi

  echo "🗑️  Removing worktree: ${worktree_path}"
  git worktree remove "$worktree_path" --force

  echo ""
  read -p "Delete branch '${branch}'? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git branch -D "$branch" 2>/dev/null && echo "  Branch '${branch}' deleted" || echo "  Branch not found locally"
  fi

  echo "✅ Worktree removed"
}

cmd_clean() {
  echo "🧹 Cleaning merged worktrees..."

  local cleaned=0
  for dir in "${WORKTREE_DIR}"/*/; do
    [[ -d "$dir" ]] || continue

    local meta_file="${dir}.worktree-meta.json"
    if [[ -f "$meta_file" ]]; then
      local branch
      branch=$(grep -o '"branch": "[^"]*"' "$meta_file" | cut -d'"' -f4)

      if [[ -n "$branch" ]] && git branch --merged origin/main | grep -q "$branch"; then
        echo "  Removing merged worktree: ${branch}"
        git worktree remove "$dir" --force 2>/dev/null || true
        git branch -D "$branch" 2>/dev/null || true
        cleaned=$((cleaned + 1))
      fi
    fi
  done

  if [[ $cleaned -eq 0 ]]; then
    echo "  No merged worktrees to clean"
  else
    echo "✅ Cleaned ${cleaned} merged worktree(s)"
  fi
}

# ── Main dispatch ──

case "${1:-}" in
  create)  cmd_create "${2:-}" "${3:-}" ;;
  list)    cmd_list ;;
  remove)  cmd_remove "${2:-}" ;;
  clean)   cmd_clean ;;
  -h|--help|help|"") usage ;;
  *)
    echo "Unknown command: $1" >&2
    usage >&2
    exit 1
    ;;
esac
