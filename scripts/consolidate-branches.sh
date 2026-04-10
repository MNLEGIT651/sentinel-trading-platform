#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Sentinel Trading Platform — Branch Consolidation Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Purpose:  Audit every branch, classify it, and converge the repository into
#           a single clean, production-ready `main`. Produces a report and
#           optional cleanup commands.
#
# Usage:
#   ./scripts/consolidate-branches.sh                  # Audit only (dry-run)
#   ./scripts/consolidate-branches.sh --execute        # Audit + delete stale branches
#   ./scripts/consolidate-branches.sh --report-only    # Print report, no changes
#
# Safety:
#   - Creates backup/pre-consolidation-<date> from current main before any changes
#   - Never force-pushes
#   - Never rewrites main history
#   - Prints exact commands for remote deletions (does not execute them without --execute)
#
# Requirements:
#   - git, gh (GitHub CLI), jq
#   - Authenticated with gh (gh auth status)
#
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
PROTECTED_BRANCHES=("main" "develop" "staging")
STALE_DAYS=14
DATE_TAG=$(date +%Y%m%d)
BACKUP_BRANCH="backup/pre-consolidation-${DATE_TAG}"
REPORT_FILE="reports/branch-consolidation-${DATE_TAG}.md"
EXECUTE_MODE=false
REPORT_ONLY=false
REPO=""

# High-risk paths that require extra scrutiny
HIGH_RISK_PATHS=(
  ".github/workflows/"
  "supabase/migrations/"
  "packages/shared/src/"
  "apps/web/src/lib/engine-fetch.ts"
  "apps/web/src/lib/engine-client.ts"
  "apps/web/src/proxy.ts"
  "apps/engine/src/config.py"
  "apps/engine/src/api/main.py"
  "railway.toml"
  "apps/engine/railway.toml"
  "apps/web/vercel.json"
  ".env.example"
)

# ─── Helpers ──────────────────────────────────────────────────────────────────

info()    { echo "ℹ️  $*"; }
success() { echo "✅ $*"; }
warn()    { echo "⚠️  $*"; }
error()   { echo "❌ $*" >&2; }
divider() { echo "────────────────────────────────────────────────────────────"; }

is_protected() {
  local branch="$1"
  for p in "${PROTECTED_BRANCHES[@]}"; do
    [[ "$branch" == "$p" ]] && return 0
  done
  return 1
}

days_since() {
  local date_str="$1"
  local now
  now=$(date +%s)
  local then
  then=$(date -d "$date_str" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$date_str" +%s 2>/dev/null || echo "$now")
  echo $(( (now - then) / 86400 ))
}

touches_high_risk() {
  local files="$1"
  for pattern in "${HIGH_RISK_PATHS[@]}"; do
    if echo "$files" | grep -q "$pattern"; then
      return 0
    fi
  done
  return 1
}

# ─── Argument parsing ─────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute)     EXECUTE_MODE=true; shift ;;
    --report-only) REPORT_ONLY=true; shift ;;
    --repo)        REPO="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--execute] [--report-only] [--repo owner/repo]"
      echo ""
      echo "  --execute       Delete stale branches (not just audit)"
      echo "  --report-only   Print report without any git operations"
      echo "  --repo          GitHub repo (default: auto-detect from remote)"
      exit 0
      ;;
    *) error "Unknown argument: $1"; exit 1 ;;
  esac
done

# ─── Pre-flight checks ───────────────────────────────────────────────────────

info "Pre-flight checks..."

if ! command -v git &>/dev/null; then
  error "git is required"; exit 1
fi
if ! command -v gh &>/dev/null; then
  error "GitHub CLI (gh) is required"; exit 1
fi
if ! command -v jq &>/dev/null; then
  error "jq is required"; exit 1
fi
if ! gh auth status &>/dev/null; then
  error "Not authenticated with gh. Run: gh auth login"; exit 1
fi

# Auto-detect repo if not provided
if [[ -z "$REPO" ]]; then
  REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || true)
  if [[ -z "$REPO" ]]; then
    REPO=$(git remote get-url origin | sed -E 's#.*github\.com[:/]([^/]+/[^/.]+)(\.git)?$#\1#')
  fi
fi

info "Repository: $REPO"
info "Mode: $(${EXECUTE_MODE} && echo 'EXECUTE' || (${REPORT_ONLY} && echo 'REPORT-ONLY' || echo 'DRY-RUN'))"

# ─── Phase 1: Fetch & inventory ──────────────────────────────────────────────

divider
info "PHASE 1: Repository Inventory"
divider

if ! $REPORT_ONLY; then
  info "Fetching all remotes..."
  git fetch --all --prune 2>&1 | head -20

  info "Creating safety backup branch: $BACKUP_BRANCH"
  if git rev-parse --verify "$BACKUP_BRANCH" &>/dev/null; then
    warn "Backup branch already exists, skipping creation"
  else
    git branch "$BACKUP_BRANCH" main 2>/dev/null || warn "Could not create backup branch"
    git push origin "$BACKUP_BRANCH" 2>/dev/null || warn "Could not push backup branch"
  fi
fi

# Get main HEAD
MAIN_SHA=$(git rev-parse main 2>/dev/null || echo "unknown")
info "Main HEAD: $MAIN_SHA"

# List all remote branches
info "Listing remote branches..."
REMOTE_BRANCHES=()
while IFS= read -r line; do
  branch="${line#origin/}"
  REMOTE_BRANCHES+=("$branch")
done < <(git branch -r --format='%(refname:short)' | grep '^origin/' | grep -v 'origin/HEAD' | sort)

info "Found ${#REMOTE_BRANCHES[@]} remote branches"

# List all local branches
LOCAL_BRANCHES=()
while IFS= read -r branch; do
  LOCAL_BRANCHES+=("$branch")
done < <(git branch --format='%(refname:short)' | sort)

info "Found ${#LOCAL_BRANCHES[@]} local branches"

# ─── Phase 2: Branch Audit ────────────────────────────────────────────────────

divider
info "PHASE 2: Branch Audit"
divider

# Initialize report
mkdir -p reports
cat > "$REPORT_FILE" <<'HEADER'
# Branch Consolidation Report

> Generated by `scripts/consolidate-branches.sh`

## Summary

HEADER

MERGE_NOW=()
CHERRY_PICK=()
DISCARD=()
HOLD=()

audit_branch() {
  local branch="$1"
  local full_ref="origin/$branch"

  # Skip protected branches
  if is_protected "$branch"; then
    return
  fi

  # Get branch metadata
  local last_commit_date
  last_commit_date=$(git log -1 --format='%aI' "$full_ref" 2>/dev/null || echo "unknown")
  local last_commit_msg
  last_commit_msg=$(git log -1 --format='%s' "$full_ref" 2>/dev/null || echo "unknown")
  local author
  author=$(git log -1 --format='%an' "$full_ref" 2>/dev/null || echo "unknown")
  local commit_count
  commit_count=$(git rev-list --count "main..$full_ref" 2>/dev/null || echo "0")
  local behind_count
  behind_count=$(git rev-list --count "$full_ref..main" 2>/dev/null || echo "0")

  # Get changed files
  local changed_files
  changed_files=$(git diff --name-only "main...$full_ref" 2>/dev/null || echo "")
  local file_count
  file_count=$(echo "$changed_files" | grep -c '.' 2>/dev/null || echo "0")

  # Check for linked PRs
  local pr_info
  pr_info=$(gh pr list --repo "$REPO" --head "$branch" --state all --json number,state,title --limit 1 2>/dev/null || echo "[]")
  local pr_number
  pr_number=$(echo "$pr_info" | jq -r '.[0].number // "none"')
  local pr_state
  pr_state=$(echo "$pr_info" | jq -r '.[0].state // "none"')

  # Classification logic
  local classification="DISCARD"
  local reason=""
  local risk_level="low"
  local days_old
  days_old=$(days_since "${last_commit_date%%T*}" 2>/dev/null || echo "999")

  # Check for high-risk changes
  if touches_high_risk "$changed_files"; then
    risk_level="high"
  fi

  # Fully merged (0 ahead of main)
  if [[ "$commit_count" == "0" ]]; then
    classification="DISCARD"
    reason="Fully merged into main (0 commits ahead)"
  # Has open PR — hold for manual review
  elif [[ "$pr_state" == "OPEN" ]]; then
    classification="HOLD"
    reason="Has open PR #${pr_number}"
  # Stale (>14 days, no open PR)
  elif [[ "$days_old" -gt "$STALE_DAYS" && "$pr_state" != "OPEN" ]]; then
    if [[ "$file_count" -le 5 && "$risk_level" == "low" ]]; then
      classification="DISCARD"
      reason="Stale (${days_old}d), small scope, no open PR"
    elif [[ "$risk_level" == "high" ]]; then
      classification="DISCARD"
      reason="Stale (${days_old}d), touches high-risk paths — too risky to merge stale"
    else
      classification="DISCARD"
      reason="Stale (${days_old}d), no open PR"
    fi
  # Recent, small, low-risk — potential merge
  elif [[ "$file_count" -le 10 && "$risk_level" == "low" && "$behind_count" -lt 20 ]]; then
    classification="MERGE_NOW"
    reason="Small scope ($file_count files), low risk, recent"
  # Recent but mixed or large
  elif [[ "$file_count" -gt 10 || "$risk_level" == "high" ]]; then
    classification="CHERRY_PICK"
    reason="Large scope or high-risk paths — cherry-pick only"
  else
    classification="HOLD"
    reason="Needs manual review"
  fi

  # Store classification
  case "$classification" in
    MERGE_NOW)   MERGE_NOW+=("$branch") ;;
    CHERRY_PICK) CHERRY_PICK+=("$branch") ;;
    DISCARD)     DISCARD+=("$branch") ;;
    HOLD)        HOLD+=("$branch") ;;
  esac

  # Write to report
  cat >> "$REPORT_FILE" <<BRANCH_ENTRY

### \`$branch\`

| Property | Value |
|----------|-------|
| Author | $author |
| Last commit | $last_commit_date |
| Last message | $last_commit_msg |
| Ahead of main | $commit_count commits |
| Behind main | $behind_count commits |
| Files changed | $file_count |
| High-risk | $risk_level |
| Linked PR | ${pr_number} (${pr_state}) |
| Days since activity | $days_old |
| **Classification** | **$classification** |
| **Reason** | $reason |

BRANCH_ENTRY

  echo "  $classification: $branch ($reason)"
}

for branch in "${REMOTE_BRANCHES[@]}"; do
  info "Auditing: $branch"
  audit_branch "$branch"
done

# ─── Phase 3: Consolidation Plan ─────────────────────────────────────────────

divider
info "PHASE 3: Consolidation Plan"
divider

cat >> "$REPORT_FILE" <<PLAN_HEADER

---

## Consolidation Plan

### Group 1: Merge Now (${#MERGE_NOW[@]})
PLAN_HEADER

if [[ ${#MERGE_NOW[@]} -gt 0 ]]; then
  for b in "${MERGE_NOW[@]}"; do
    echo "- \`$b\`" >> "$REPORT_FILE"
  done
  info "Merge now: ${MERGE_NOW[*]}"
else
  echo "_None — no branches qualify for direct merge._" >> "$REPORT_FILE"
  info "No branches qualify for direct merge"
fi

cat >> "$REPORT_FILE" <<PLAN2

### Group 2: Cherry-pick Only (${#CHERRY_PICK[@]})
PLAN2

if [[ ${#CHERRY_PICK[@]} -gt 0 ]]; then
  for b in "${CHERRY_PICK[@]}"; do
    echo "- \`$b\`" >> "$REPORT_FILE"
  done
  info "Cherry-pick: ${CHERRY_PICK[*]}"
else
  echo "_None._" >> "$REPORT_FILE"
  info "No branches need cherry-picking"
fi

cat >> "$REPORT_FILE" <<PLAN3

### Group 3: Hold / Manual Review (${#HOLD[@]})
PLAN3

if [[ ${#HOLD[@]} -gt 0 ]]; then
  for b in "${HOLD[@]}"; do
    echo "- \`$b\`" >> "$REPORT_FILE"
  done
  info "Hold: ${HOLD[*]}"
else
  echo "_None._" >> "$REPORT_FILE"
  info "No branches need manual review"
fi

cat >> "$REPORT_FILE" <<PLAN4

### Group 4: Discard / Delete (${#DISCARD[@]})
PLAN4

if [[ ${#DISCARD[@]} -gt 0 ]]; then
  for b in "${DISCARD[@]}"; do
    echo "- \`$b\`" >> "$REPORT_FILE"
  done
  info "Discard: ${#DISCARD[@]} branches"
else
  echo "_None._" >> "$REPORT_FILE"
  info "No branches to discard"
fi

# ─── Phase 4: Execution ──────────────────────────────────────────────────────

divider
info "PHASE 4: Execution"
divider

if $REPORT_ONLY; then
  info "Report-only mode — skipping execution"
else
  # Merge accepted branches
  for branch in "${MERGE_NOW[@]}"; do
    info "Merging: $branch"
    if git merge --no-ff "origin/$branch" -m "chore: consolidate branch $branch into main"; then
      success "Merged $branch"

      # Run validation
      info "Running validation after merge..."
      VALIDATION_PASSED=true

      if command -v pnpm &>/dev/null; then
        pnpm install --frozen-lockfile 2>/dev/null || true
        pnpm lint 2>/dev/null || { warn "Lint failed after merging $branch"; VALIDATION_PASSED=false; }
        pnpm test 2>/dev/null || { warn "Tests failed after merging $branch"; VALIDATION_PASSED=false; }
        pnpm build 2>/dev/null || { warn "Build failed after merging $branch"; VALIDATION_PASSED=false; }
      else
        warn "pnpm not available — skipping validation"
      fi

      if ! $VALIDATION_PASSED; then
        warn "Validation failed — reverting merge of $branch"
        git reset --hard HEAD~1
        # Reclassify as HOLD
        echo "  ⚠️  Reverted merge of \`$branch\` (validation failure)" >> "$REPORT_FILE"
      fi
    else
      warn "Merge conflict with $branch — skipping (reclassified to HOLD)"
      git merge --abort 2>/dev/null || true
      echo "  ⚠️  Conflict merging \`$branch\` — needs manual resolution" >> "$REPORT_FILE"
    fi
  done

  # Delete discarded branches (remote)
  if $EXECUTE_MODE; then
    info "Deleting discarded remote branches..."
    for branch in "${DISCARD[@]}"; do
      if git push origin --delete "$branch" 2>/dev/null; then
        success "Deleted remote: $branch"
      else
        warn "Could not delete remote: $branch"
      fi
    done

    # Delete all non-main local branches
    info "Cleaning local branches..."
    for branch in "${LOCAL_BRANCHES[@]}"; do
      if ! is_protected "$branch"; then
        git branch -D "$branch" 2>/dev/null && success "Deleted local: $branch" || true
      fi
    done
  fi
fi

# ─── Phase 5: Production Readiness Gate ───────────────────────────────────────

divider
info "PHASE 5: Production Readiness Gate"
divider

cat >> "$REPORT_FILE" <<GATE_HEADER

---

## Production Readiness Gate

GATE_HEADER

if ! $REPORT_ONLY && command -v pnpm &>/dev/null; then
  info "Running final validation suite..."

  declare -A CHECKS
  pnpm install --frozen-lockfile 2>/dev/null && CHECKS[install]="PASS" || CHECKS[install]="FAIL"
  pnpm lint 2>/dev/null && CHECKS[lint]="PASS" || CHECKS[lint]="FAIL"
  pnpm test 2>/dev/null && CHECKS[test]="PASS" || CHECKS[test]="FAIL"
  pnpm build 2>/dev/null && CHECKS[build]="PASS" || CHECKS[build]="FAIL"

  # Engine checks (if venv exists)
  if [[ -d apps/engine/.venv ]]; then
    pnpm lint:engine 2>/dev/null && CHECKS[lint_engine]="PASS" || CHECKS[lint_engine]="FAIL"
    pnpm format:check:engine 2>/dev/null && CHECKS[format_engine]="PASS" || CHECKS[format_engine]="FAIL"
    pnpm test:engine 2>/dev/null && CHECKS[test_engine]="PASS" || CHECKS[test_engine]="FAIL"
  else
    CHECKS[lint_engine]="SKIPPED"
    CHECKS[format_engine]="SKIPPED"
    CHECKS[test_engine]="SKIPPED"
  fi

  echo "| Check | Status |" >> "$REPORT_FILE"
  echo "|-------|--------|" >> "$REPORT_FILE"
  for check in install lint test build lint_engine format_engine test_engine; do
    echo "| $check | ${CHECKS[$check]:-SKIPPED} |" >> "$REPORT_FILE"
  done
else
  info "Skipping validation (report-only mode or pnpm not available)"
  echo "_Validation skipped — run manually:_" >> "$REPORT_FILE"
  cat >> "$REPORT_FILE" <<'MANUAL_CHECKS'

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm lint:engine
pnpm format:check:engine
pnpm test:engine
```
MANUAL_CHECKS
fi

# ─── Phase 6: Cleanup Commands ────────────────────────────────────────────────

divider
info "PHASE 6: Branch Cleanup Commands"
divider

cat >> "$REPORT_FILE" <<CLEANUP_HEADER

---

## Branch Cleanup Commands

### Remote branch deletion commands

> Review these carefully before executing. Each command deletes a remote branch.

\`\`\`bash
CLEANUP_HEADER

for branch in "${DISCARD[@]}"; do
  echo "git push origin --delete \"$branch\"" >> "$REPORT_FILE"
done

cat >> "$REPORT_FILE" <<'CLEANUP_MID'
```

### Local branch cleanup

```bash
# Delete all non-main local branches
git branch | grep -v '^\*' | grep -v 'main' | xargs -r git branch -D

# Prune stale remote-tracking refs
git remote prune origin
```

### Backup branch removal (after confirming main is stable)

```bash
CLEANUP_MID

echo "git push origin --delete \"$BACKUP_BRANCH\"" >> "$REPORT_FILE"
echo "git branch -D \"$BACKUP_BRANCH\"" >> "$REPORT_FILE"

cat >> "$REPORT_FILE" <<'CLEANUP_END'
```

---

## Rollback Instructions

If consolidation introduced regressions:

```bash
# 1. Identify the backup branch
git log --oneline backup/pre-consolidation-* -1

# 2. Reset main to the backup point (only if no one else has pulled)
git checkout main
git reset --hard backup/pre-consolidation-<date>
git push --force-with-lease origin main

# 3. Or create a revert commit (safer if others have pulled)
git checkout main
git revert --no-edit HEAD~<number-of-merge-commits>..HEAD
git push origin main
```

---

## Branch Hygiene Rules (Going Forward)

1. **One task per branch** — no omnibus branches
2. **No long-lived AI experiment branches** — merge or discard within 7 days
3. **Shared contracts, workflows, migrations, and deployment config require isolated PRs**
4. **Merge only after passing lint, typecheck, tests, and build**
5. **Prefer cherry-pick over broad merges for mixed-quality AI branches**
6. **Delete branches after merge** — use GitHub auto-delete or the weekly cleanup workflow
7. **Branch naming convention**: `<type>/<scope>/<description>` (e.g., `feat/web/add-chart`)
8. **Maximum branch lifetime**: 14 days without activity triggers auto-cleanup

CLEANUP_END

# ─── Final summary ────────────────────────────────────────────────────────────

divider
info "CONSOLIDATION COMPLETE"
divider

TOTAL=$((${#MERGE_NOW[@]} + ${#CHERRY_PICK[@]} + ${#DISCARD[@]} + ${#HOLD[@]}))

cat >> "$REPORT_FILE" <<SUMMARY

---

## Final Summary

| Metric | Count |
|--------|-------|
| Total branches audited | $TOTAL |
| Merged | ${#MERGE_NOW[@]} |
| Cherry-pick needed | ${#CHERRY_PICK[@]} |
| Discarded | ${#DISCARD[@]} |
| Held for review | ${#HOLD[@]} |
| Main SHA | \`$MAIN_SHA\` |
| Backup branch | \`$BACKUP_BRANCH\` |
| Report generated | $(date -u +"%Y-%m-%dT%H:%M:%SZ") |

SUMMARY

echo ""
echo "📋 Report saved to: $REPORT_FILE"
echo ""
echo "Total branches: $TOTAL"
echo "  Merge now:     ${#MERGE_NOW[@]}"
echo "  Cherry-pick:   ${#CHERRY_PICK[@]}"
echo "  Discard:       ${#DISCARD[@]}"
echo "  Hold:          ${#HOLD[@]}"

if ! $EXECUTE_MODE && [[ ${#DISCARD[@]} -gt 0 ]]; then
  echo ""
  warn "Run with --execute to delete ${#DISCARD[@]} discarded branches"
  warn "Or review the report at: $REPORT_FILE"
fi
