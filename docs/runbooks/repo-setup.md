# GitHub Repository Setup Runbook

Use this runbook to validate that your local clone and GitHub repository settings meet the baseline expected for a professional team workflow.

## 1) Local Git Sanity Checks

Run from repo root:

```bash
git status -sb
git remote -v
git branch -vv
git rev-parse --abbrev-ref HEAD
git fetch --all --prune
```

Expected baseline:

- `origin` exists and points to your canonical GitHub repo URL.
- Your working branch tracks a remote branch.
- `git fetch --all --prune` completes without errors.

If `origin` is missing:

```bash
git remote add origin <your_github_repo_url>
git fetch origin --prune
```

If local `main` does not track remote `main`:

```bash
git checkout -b main --track origin/main
# or, if main already exists locally
git branch --set-upstream-to=origin/main main
```

## 2) Automated Local Audit

Run the built-in audit script:

```bash
bash scripts/repo-setup-audit.sh
```

This checks:

- git remotes, branch tracking, and fetch/prune health
- required collaboration/security docs
- baseline GitHub metadata folders (`.github/workflows`, templates, CODEOWNERS)

## 3) GitHub Web UI Settings (Manual)

These cannot be fully enforced from local code, so configure them in GitHub:

1. **Branch protection on `main`**
   - Require pull request before merge
   - Require status checks to pass
   - Require up-to-date branches before merge
   - Restrict force pushes and branch deletion
2. **Security features**
   - Enable Dependabot alerts and security updates
   - Enable secret scanning and push protection
   - Enable code scanning (CodeQL)
3. **Repository hygiene**
   - Enable auto-delete head branches after merge
   - Set merge strategy policy (squash, merge, or rebase)
   - Verify default branch is `main`
4. **Team collaboration**
   - Confirm CODEOWNERS reviews are required where desired
   - Configure required reviewer count

## 4) Optional GitHub CLI Verification

If `gh` is authenticated, you can inspect settings:

```bash
gh repo view --json nameWithOwner,defaultBranchRef,isPrivate
# requires admin permission on the repo
gh api repos/<owner>/<repo>/branches/main/protection
```

## 5) Recommended Ongoing Habit

Run this before opening a PR:

```bash
bash scripts/repo-setup-audit.sh
git diff --check
```

If the audit reports warnings/failures, resolve them before requesting review.
