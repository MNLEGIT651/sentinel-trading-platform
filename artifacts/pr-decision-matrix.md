# PR Decision Matrix — Trading-App

**Date:** 2026-04-07
**Branch:** `main` @ `9f52598`
**Auditor:** Release Engineering Audit (automated)

## Summary

| PR   | Title                                                      | Risk          | Decision             | Reason                                                |
| ---- | ---------------------------------------------------------- | ------------- | -------------------- | ----------------------------------------------------- |
| #268 | fix: release audit remediation                             | infra         | **MERGE FIRST**      | Unblocks CI for all other PRs                         |
| #250 | ci: bump github-actions group                              | infra         | APPROVE (after #268) | Safe, all actions pinned by dependabot                |
| #223 | chore(agents): bump @anthropic-ai/sdk 0.82→0.85            | runtime       | APPROVE (after #268) | Minor SDK bump, low risk                              |
| #226 | chore(agents): bump @supabase/supabase-js 2.101→2.102      | runtime       | APPROVE (after #268) | Patch bump, low risk                                  |
| #225 | chore(web): bump @vitest/browser-playwright 4.1.1→4.1.3    | devtools      | APPROVE (after #268) | Dev-only dep, no prod impact                          |
| #224 | chore(web): bump eslint-plugin-storybook 10.3.4→10.3.5     | devtools      | APPROVE (after #268) | Dev-only dep, no prod impact                          |
| #227 | chore(web): bump storybook 10.3.3→10.3.5                   | devtools      | APPROVE (after #268) | Dev-only dep, no prod impact                          |
| #228 | chore(web): bump @storybook/nextjs-vite 10.3.3→10.3.5      | devtools      | APPROVE (after #268) | Dev-only dep, no prod impact                          |
| #230 | chore(web): bump @storybook/addon-onboarding 10.3.3→10.3.5 | devtools      | APPROVE (after #268) | Dev-only dep, no prod impact                          |
| #266 | chore: bump root-dev group (23 updates)                    | devtools      | CHANGES_REQUESTED    | Has merge conflicts (CONFLICTING)                     |
| #222 | Platform contract enforcement                              | infra/runtime | CHANGES_REQUESTED    | Has merge conflicts; overlaps heavily with #268 fixes |

## Recommended Merge Order

1. **#268** — Release audit remediation (MERGE FIRST — unblocks CI)
2. **#250** — GitHub Actions group bump
3. **#223** — Anthropic SDK bump (agents)
4. **#226** — Supabase JS bump (agents)
5. **#225** — Vitest browser-playwright bump (web)
6. **#224** — ESLint storybook plugin bump (web)
7. **#227, #228, #230** — Storybook bumps (web, can merge in any order)
8. **#266** — Root-dev group bump (needs rebase after above merges)
9. **#222** — Platform contract enforcement (needs rebase; review overlap with #268)

## Blockers

### Systemic (all PRs)

- **Verify Commit Signatures** fails on all dependabot PRs — dependabot doesn't GPG-sign commits. Consider making this check non-required for dependabot, or using `dependabot-auto-merge.yml` to rebase with signed commits.
- **Gitleaks** fails on all dependabot PRs — likely detecting pre-existing secrets in git history, not introduced by the dependency bumps. Consider baseline allowlist.
- **Railway sentinel-agents build** fails — independent of PR content; agents service has a build issue to investigate.

### Per-PR

- **#266** — merge conflicts with `main`; needs manual rebase of lockfile
- **#222** — merge conflicts with `main`; significant overlap with #268 changes; needs conflict resolution and review to avoid duplicating fixes

## Risk Classification Key

- **infra** — CI/CD, workflows, deploy config
- **security** — auth, secrets, scanning
- **runtime** — production application code/deps
- **data-contract** — API schemas, DB types, env contracts
- **devtools** — dev-only dependencies (storybook, test, lint)
- **docs** — documentation only
