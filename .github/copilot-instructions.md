# Sentinel Trading Platform — Copilot repository instructions

Use these instructions for Copilot Chat, Copilot code review, and Copilot coding agent.

## Task scoping and safety

- Keep diffs minimal and scoped to the request.
- **PR scope limit**: Each PR must touch ≤20 files and address a single concern. If scope
  exceeds this, split into multiple PRs.
- **File size limit**: No source file shall exceed 400 lines. If a file approaches this limit,
  decompose it before adding more code.
- **Fresh branch**: Always branch from current `main` HEAD. Run
  `git fetch origin && git rev-list --count HEAD..origin/main` to verify ≤5 commits behind.
- **Overlap check**: Before starting work, check open PRs (`gh pr list`) and avoid touching
  files that are already in flight in another PR.
- Do not modify protected files without explicit request:
  - `package.json`, `pnpm-lock.yaml`, `turbo.json`, `apps/web/vercel.json`
  - `supabase/migrations/*`
  - `packages/shared/src/*`
- Preserve offline/fallback provenance behavior (`OfflineBanner`, `SimulatedBadge`).
- Do not add raw browser calls to engine/agents backends; route via existing proxy patterns.

## Validation requirements

- Docs-only changes: `git diff --check`
- Node workspaces: `pnpm lint`, `pnpm test`, `pnpm build`
- Engine changes: `pnpm lint:engine`, `pnpm format:check:engine`, `pnpm test:engine`
- CI/workflow/security automation changes:
  - `git diff --check`
  - `node scripts/security-audit.mjs` when permissions/dependency audit automation is touched

Always report exact commands with PASS/FAIL/SKIPPED and reason for any skip.

## Deployment/release policy

- No silent skip on smoke/health/deploy gates.
- Deterministic tooling only (pinned CLI/action versions).
- Fail closed for missing secrets in deploy workflows.

## Custom specialist agents

Use these custom agents for recurring workflows:

- `repo-commander` — full-access operations agent (PRs, settings, CI/CD, quality)
- `repo-guardian` — read-only audit agent (PR health, branch drift, architecture review)
- `platform-sync-auditor`
- `runtime-smoke-guardian`
- `supabase-boundary-guardian`
- `pr-owner-operator`

## PR Guardian (automated CI gate)

The `PR Guardian` workflow runs automatically on every PR. It checks scope, staleness,
file health, overlap with other PRs, high-risk path changes, import validity, and
single-concern enforcement. See `AGENTS.md` for thresholds.

Run locally before creating a PR:

```bash
node scripts/pr-guardian.mjs --local
```
