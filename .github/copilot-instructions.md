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

## Custom specialist agents

Use these custom agents for recurring workflows:

- `platform-sync-auditor`
- `runtime-smoke-guardian`
- `supabase-boundary-guardian`
- `pr-owner-operator`
