# Sentinel Trading Platform — Copilot repository instructions

Use these instructions for Copilot Chat, Copilot code review, and Copilot coding agent.

## Task scoping and safety

- Keep diffs minimal and scoped to the request.
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
- Respect guarded auto-merge: low-risk PRs may auto-merge after checks; escalated PRs
  require `decision/human-approved`.

## Custom specialist agents

Use these custom agents for recurring workflows:

- `repo-commander` — full-access operations agent (PRs, settings, CI/CD, quality)
- `platform-sync-auditor`
- `runtime-smoke-guardian`
- `supabase-boundary-guardian`
- `pr-owner-operator`

## Multi-provider defaults

- GitHub custom agents own PR policy classification and merge summaries.
- Claude is the escalation path for architecture ambiguity, debugging, and review.
- Codex is the default implementation agent for bounded code and test changes.
