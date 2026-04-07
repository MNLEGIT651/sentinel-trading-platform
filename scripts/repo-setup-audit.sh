#!/usr/bin/env bash
set -euo pipefail

# Repository Security Setup Audit
# Verifies that recommended GitHub security and automation settings are
# configured for the Sentinel Trading Platform.
#
# Requirements:
#   - gh CLI authenticated (`gh auth status`)
#   - jq
#
# Usage:
#   ./scripts/repo-setup-audit.sh [--verbose]

VERBOSE=false
FAILURES=0
PASSES=0
WARNINGS=0

REPO="${GITHUB_REPOSITORY:-stevenschling13/Trading-App}"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
DEFAULT_BRANCH="main"

# --- helpers ----------------------------------------------------------------

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Audit GitHub repository security and automation settings.

Options:
  --repo OWNER/REPO   Override target repository (default: $REPO)
  --verbose, -v       Show detailed output
  --help, -h          Show this help message
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; OWNER="${REPO%%/*}"; REPO_NAME="${REPO##*/}"; shift 2 ;;
    --verbose|-v) VERBOSE=true; shift ;;
    --help|-h) usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

verbose() {
  if [[ "$VERBOSE" == true ]]; then
    printf "  %s\n" "$*"
  fi
}

pass() {
  printf "  ✅  %s\n" "$1"
  ((PASSES++))
}

fail() {
  printf "  ❌  %s\n" "$1"
  ((FAILURES++))
}

warn() {
  printf "  ⚠️   %s\n" "$1"
  ((WARNINGS++))
}

section() {
  printf "\n── %s ──\n" "$1"
}

# --- preflight --------------------------------------------------------------

for cmd in gh jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd is required but not installed." >&2
    exit 2
  fi
done

if ! gh auth status &>/dev/null; then
  echo "Error: gh CLI is not authenticated. Run 'gh auth login' first." >&2
  exit 2
fi

printf "🔍 Repository Security Audit: %s\n" "$REPO"
printf "════════════════════════════════════════════\n"

# === 1. Branch protection ====================================================

section "Branch Protection ($DEFAULT_BRANCH)"

# Try rulesets first (newer API), fall back to classic branch protection
RULESETS=$(gh api "repos/$REPO/rulesets" --jq 'length' 2>/dev/null || echo "0")
verbose "Rulesets found: $RULESETS"

if [[ "$RULESETS" -gt 0 ]]; then
  pass "Repository rulesets configured ($RULESETS ruleset(s))"

  # Check for a ruleset that targets the default branch
  MAIN_RULESET=$(gh api "repos/$REPO/rulesets" \
    --jq "[.[] | select(.conditions.ref_name.include[]? | test(\"main|default\"))] | length" 2>/dev/null || echo "0")
  if [[ "$MAIN_RULESET" -gt 0 ]]; then
    pass "Ruleset targets $DEFAULT_BRANCH branch"
  else
    warn "No ruleset explicitly targets '$DEFAULT_BRANCH' — verify in Settings → Rules"
  fi
else
  # Fall back to classic branch protection
  BP=$(gh api "repos/$REPO/branches/$DEFAULT_BRANCH/protection" 2>/dev/null || echo "{}")

  if echo "$BP" | jq -e '.url' &>/dev/null; then
    pass "Classic branch protection enabled on $DEFAULT_BRANCH"

    # Required pull request reviews
    if echo "$BP" | jq -e '.required_pull_request_reviews' &>/dev/null; then
      APPROVALS=$(echo "$BP" | jq '.required_pull_request_reviews.required_approving_review_count // 0')
      pass "Require pull request reviews (approvals: $APPROVALS)"
    else
      fail "Pull request reviews not required"
    fi

    # Required status checks
    if echo "$BP" | jq -e '.required_status_checks' &>/dev/null; then
      STRICT=$(echo "$BP" | jq '.required_status_checks.strict')
      pass "Required status checks enabled (strict: $STRICT)"
      CONTEXTS=$(echo "$BP" | jq -r '.required_status_checks.contexts[]?' 2>/dev/null || echo "")
      for ctx in "Test Web" "Test Engine" "Test Agents"; do
        if echo "$CONTEXTS" | grep -qF "$ctx"; then
          pass "Required check: $ctx"
        else
          warn "Expected required check '$ctx' not found"
        fi
      done
    else
      fail "Status checks not required"
    fi

    # Enforce admins
    if echo "$BP" | jq -e '.enforce_admins.enabled == true' &>/dev/null; then
      pass "Branch protection enforced for administrators"
    else
      warn "Administrators can bypass branch protection"
    fi
  else
    fail "No branch protection on $DEFAULT_BRANCH"
  fi
fi

# === 2. Dependabot configuration =============================================

section "Dependabot"

if [[ -f ".github/dependabot.yml" ]] || [[ -f ".github/dependabot.yaml" ]]; then
  pass "Dependabot configuration file present"

  # Count ecosystems
  ECOSYSTEMS=$(grep -c 'package-ecosystem:' .github/dependabot.yml 2>/dev/null || echo "0")
  verbose "Ecosystems configured: $ECOSYSTEMS"

  for eco in "github-actions" "npm" "pip"; do
    if grep -q "package-ecosystem: $eco" .github/dependabot.yml 2>/dev/null; then
      pass "Dependabot covers $eco"
    else
      warn "Dependabot does not cover $eco"
    fi
  done
else
  fail "No .github/dependabot.yml found"
fi

# Check if Dependabot alerts are enabled via the API (requires admin scope)
VULN_ALERTS=$(gh api "repos/$REPO/vulnerability-alerts" -i 2>/dev/null | head -1 || echo "")
if echo "$VULN_ALERTS" | grep -q "204"; then
  pass "Dependabot vulnerability alerts enabled"
elif echo "$VULN_ALERTS" | grep -q "404"; then
  warn "Dependabot vulnerability alerts not enabled (or insufficient permissions to check)"
else
  verbose "Could not determine Dependabot alerts status"
  warn "Unable to verify Dependabot alerts (check permissions)"
fi

# === 3. Secret scanning & push protection ====================================

section "Secret Scanning & Push Protection"

# These settings are not reliably queryable without admin access on all plans,
# so we verify the local configuration and documentation.
SECRET_SCAN_DOCS=$(grep -rlic "secret scanning" SECURITY.md docs/ 2>/dev/null || echo "0")
if [[ "$SECRET_SCAN_DOCS" -gt 0 ]]; then
  pass "Secret scanning documented in repository"
else
  warn "Secret scanning not mentioned in SECURITY.md or docs/"
fi

PUSH_PROT_DOCS=$(grep -rlic "push protection" SECURITY.md docs/ 2>/dev/null || echo "0")
if [[ "$PUSH_PROT_DOCS" -gt 0 ]]; then
  pass "Push protection documented in repository"
else
  warn "Push protection not mentioned in SECURITY.md or docs/"
fi

# === 4. CodeQL / code scanning ===============================================

section "Code Scanning (CodeQL)"

# Check for CodeQL alerts endpoint (indicates code scanning is configured)
CODEQL_STATUS=$(gh api "repos/$REPO/code-scanning/alerts?per_page=1" -i 2>/dev/null | head -1 || echo "")
if echo "$CODEQL_STATUS" | grep -q "200"; then
  pass "Code scanning (CodeQL) is active"
elif echo "$CODEQL_STATUS" | grep -q "404"; then
  warn "Code scanning not enabled or no results yet"
else
  verbose "Code scanning status response: $CODEQL_STATUS"
  warn "Unable to verify code scanning status"
fi

# Check for CodeQL workflow or default setup documentation
CODEQL_WORKFLOW=$(find .github/workflows -name '*codeql*' -o -name '*code-scanning*' 2>/dev/null | head -1 || echo "")
if [[ -n "$CODEQL_WORKFLOW" ]]; then
  pass "CodeQL workflow found: $CODEQL_WORKFLOW"
else
  verbose "No dedicated CodeQL workflow — may be using default setup via GitHub UI"
  warn "No CodeQL workflow file found (OK if using GitHub default setup)"
fi

# === 5. CI workflow security practices =======================================

section "CI Workflow Security"

# Check that all workflows declare top-level permissions
WORKFLOW_DIR=".github/workflows"
if [[ -d "$WORKFLOW_DIR" ]]; then
  TOTAL_WORKFLOWS=0
  PERMS_MISSING=0

  for wf in "$WORKFLOW_DIR"/*.yml "$WORKFLOW_DIR"/*.yaml; do
    [[ -f "$wf" ]] || continue
    ((TOTAL_WORKFLOWS++))
    if ! grep -q '^permissions:' "$wf" 2>/dev/null; then
      ((PERMS_MISSING++))
      verbose "Missing top-level permissions: $(basename "$wf")"
    fi
  done

  if [[ "$PERMS_MISSING" -eq 0 ]]; then
    pass "All $TOTAL_WORKFLOWS workflows declare top-level permissions"
  else
    fail "$PERMS_MISSING of $TOTAL_WORKFLOWS workflow(s) missing top-level permissions"
  fi

  # Check that actions are pinned to SHAs (not tags)
  TAG_USES=0
  for wf in "$WORKFLOW_DIR"/*.yml "$WORKFLOW_DIR"/*.yaml; do
    [[ -f "$wf" ]] || continue
    # Match `uses: org/action@vN` (tag) but not `uses: org/action@<sha>`
    if grep -E 'uses:[[:space:]]+[^[:space:]]+@v[0-9]' "$wf" &>/dev/null; then
      ((TAG_USES++))
      verbose "Tag-pinned action in: $(basename "$wf")"
    fi
  done

  if [[ "$TAG_USES" -eq 0 ]]; then
    pass "All workflow actions pinned to commit SHAs"
  else
    fail "$TAG_USES workflow(s) use tag-pinned actions instead of SHA pins"
  fi
else
  fail "No .github/workflows directory found"
fi

# === 6. Security audit script ================================================

section "Security Tooling"

if [[ -f "scripts/security-audit.mjs" ]]; then
  pass "Security audit script present (scripts/security-audit.mjs)"
else
  warn "scripts/security-audit.mjs not found"
fi

# Check for dependency-review workflow
if [[ -f ".github/workflows/dependency-review.yml" ]]; then
  pass "Dependency review workflow present"
else
  warn "No dependency-review workflow found"
fi

# === 7. CODEOWNERS ===========================================================

section "Repository Governance"

if [[ -f ".github/CODEOWNERS" ]]; then
  pass "CODEOWNERS file present"
else
  warn "No CODEOWNERS file — consider adding .github/CODEOWNERS"
fi

if [[ -f "SECURITY.md" ]]; then
  pass "SECURITY.md present"
else
  fail "No SECURITY.md — add a security policy"
fi

# === Summary ==================================================================

printf "\n════════════════════════════════════════════\n"
printf "Audit Summary for %s\n\n" "$REPO"
printf "  Passed:   %d\n" "$PASSES"
printf "  Warnings: %d\n" "$WARNINGS"
printf "  Failed:   %d\n" "$FAILURES"
printf "\n"

if [[ "$FAILURES" -gt 0 ]]; then
  printf "❌ %d check(s) failed — review the output above.\n" "$FAILURES"
  exit 1
elif [[ "$WARNINGS" -gt 0 ]]; then
  printf "⚠️  All critical checks passed, but %d warning(s) to review.\n" "$WARNINGS"
  exit 0
else
  printf "✅ All checks passed — repository security looks good!\n"
  exit 0
fi
