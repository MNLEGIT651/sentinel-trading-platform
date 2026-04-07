# Release Orchestrator Summary — Trading-App

**Date:** 2026-04-07
**Repo:** `stevenschling13/Trading-App`
**Default branch:** `main` @ `9f52598`
**Audit branch:** `fix/release-audit-remediation` @ `8e51a5b`
**PR:** [#268](https://github.com/stevenschling13/Trading-App/pull/268)

---

## 🔴 Release Verdict: **BLOCKED_BY_MISSING_ACCESS_OR_SECRETS**

### Reason

While all repo-side fixes have been applied and PR #268 is ready for merge, the release cannot be declared GO because:

1. **Cannot verify dashboard-only settings** — Supabase auth redirect URLs, RLS policies, and Vercel/Railway env var values cannot be confirmed from repo alone.
2. **Railway sentinel-agents build failure** — Independent of our changes; agents service has a pre-existing build issue that needs investigation.
3. **Gitleaks failures on dependabot PRs** — Pre-existing secrets in git history trigger Gitleaks on every PR. Needs baseline allowlist or history remediation.
4. **No human reviews** on any open PR — repo policy requires reviews.

### What Would Make This GO

1. ✅ Merge PR #268 (release audit remediation)
2. ⬜ Verify Supabase dashboard settings (auth redirects, RLS)
3. ⬜ Verify Vercel env vars are set for production + preview
4. ⬜ Verify Railway env vars for engine + agents services
5. ⬜ Fix agents service build failure
6. ⬜ Configure Gitleaks baseline allowlist (`.gitleaksignore`)
7. ⬜ Decide policy for dependabot commit signature verification

---

## Branch State

| Item           | Value                               |
| -------------- | ----------------------------------- |
| Default branch | `main`                              |
| Main SHA       | `9f52598`                           |
| Local state    | Current with `origin/main`          |
| Total branches | 16                                  |
| Open PRs       | 11 (including #268 from this audit) |

---

## Repo-Side Fixes Completed (PR #268)

### 6 commits, 10 files changed, +30/−28 lines

| #   | Commit    | Files                                    | Fix                                                   |
| --- | --------- | ---------------------------------------- | ----------------------------------------------------- |
| 1   | `d216799` | `apps/web/vercel.json`                   | Fix ignoreCommand >256 char limit (unblocks 8/10 PRs) |
| 2   | `956de3a` | 4 workflow files                         | Pin 8 floating GitHub Action refs to SHA digests      |
| 3   | `f345399` | `supabase-typegen.yml`                   | Fix `if:` conditions using unavailable context        |
| 4   | `c102048` | `health-check.sh`, `smoke-test.sh`       | Remove hardcoded production Supabase URL              |
| 5   | `4ef7660` | `.env.example`, `release-management.yml` | Add missing engine vars, fix env var naming           |
| 6   | `8e51a5b` | `supabase-typegen.yml`                   | Move secrets to job-level env (fixes actionlint)      |

### Impact of Fixes

| Issue                        | Before                                | After                             |
| ---------------------------- | ------------------------------------- | --------------------------------- |
| Vercel preview builds        | ❌ Fail (ignoreCommand >256 chars)    | ✅ Uses script reference          |
| Action supply-chain security | ⚠️ 8 floating refs                    | ✅ All SHA-pinned                 |
| Supabase typegen             | ❌ Never runs (broken if: condition)  | ✅ Runs when secret present       |
| Health/smoke scripts         | ⚠️ Fail-open (hardcoded URL fallback) | ✅ Fail-closed                    |
| .env.example completeness    | ⚠️ Missing 6 engine vars              | ✅ Complete                       |
| CRON_SECRET documentation    | ⚠️ Marked optional                    | ✅ Marked required for production |
| Release workflow env var     | ⚠️ Uses legacy ANON_KEY name          | ✅ Uses PUBLISHABLE_DEFAULT_KEY   |

---

## Open PRs — Decision Matrix

| PR   | Decision          | Type     |       Merge Order        |
| ---- | ----------------- | -------- | :----------------------: |
| #268 | **MERGE FIRST**   | infra    |            1             |
| #250 | APPROVE           | infra    |            2             |
| #223 | APPROVE           | runtime  |            3             |
| #226 | APPROVE           | runtime  |            4             |
| #225 | APPROVE           | devtools |            5             |
| #224 | APPROVE           | devtools |            6             |
| #227 | APPROVE           | devtools |            7             |
| #228 | APPROVE           | devtools |            8             |
| #230 | APPROVE           | devtools |            9             |
| #266 | CHANGES_REQUESTED | devtools |    10 (needs rebase)     |
| #222 | CHANGES_REQUESTED | infra    | 11 (conflicts with #268) |

See `artifacts/pr-decision-matrix.md` for full rationale.

---

## Platform Blockers

### GitHub (repo-side) — ✅ Fixed

- ~~Vercel ignoreCommand too long~~ → Fixed
- ~~Floating action refs~~ → All pinned
- ~~Typegen if: bug~~ → Fixed
- ~~Hardcoded production URLs~~ → Removed

### GitHub (policy) — ⚠️ Needs Decision

- Gitleaks fails on dependabot PRs (pre-existing secrets in history)
- Verify Commit Signatures fails for dependabot (unsigned bot commits)
- No human reviews on any PR

### Vercel — ⬜ Cannot Verify

- Env var values (SUPABASE_URL, keys, ENGINE_URL, CRON_SECRET) must be verified in Vercel dashboard
- Build should succeed once #268 is merged (ignoreCommand fix)

### Railway — ⚠️ Build Failure

- `sentinel-agents` build fails independently of PR content
- Env var values must be verified in Railway dashboard
- Deploy workflow itself is exemplary (fail-closed, SHA-pinned, health checks)

### Supabase — ⬜ Cannot Verify

- Auth redirect URLs must be verified in Supabase dashboard
- RLS policies partially verifiable via migrations but full audit needs dashboard
- Typegen will work once #268 merges and `SUPABASE_ACCESS_TOKEN` secret is set

---

## Validation Results

| Check                            | Result  | Notes                                                               |
| -------------------------------- | ------- | ------------------------------------------------------------------- |
| `git diff --check`               | ✅ Pass | No whitespace errors                                                |
| `actionlint` (typegen)           | ✅ Pass | Only SC2129 style warning remains                                   |
| `pnpm install --frozen-lockfile` | ✅ Pass | Lockfile current                                                    |
| `pnpm run lint`                  | ❌ Fail | Pre-existing: eslint not installed in @sentinel/web                 |
| `pnpm run typecheck`             | ❌ Fail | Pre-existing: 61 TS errors in web tests (not caused by our changes) |

---

## Credential Inventory Summary

See `artifacts/credential-inventory.md` for full inventory.

- **38 unique environment variables** across 4 platforms
- **8 GitHub Actions secrets** required for CI/CD
- **3 GitHub Actions variables** for build configuration
- **7 Vercel env vars** (3 client-side, 4 server-side)
- **10 Railway engine vars**, **7 Railway agents vars**
- **5 variables missing from .env.example** (ANTHROPIC*API_KEY, WEB_URL, ALPACA_BROKER*\*)

---

## Files Changed

```
apps/web/vercel.json
.github/workflows/gitleaks.yml
.github/workflows/workflow-lint.yml
.github/workflows/scorecards.yml
.github/workflows/codeql.yml
.github/workflows/supabase-typegen.yml
.github/workflows/release-management.yml
scripts/health-check.sh
scripts/smoke-test.sh
.env.example
artifacts/release-orchestrator-summary.md (this file)
artifacts/release-orchestrator-report.json
artifacts/pr-decision-matrix.md
artifacts/credential-inventory.md
```
