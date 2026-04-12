# Sentinel Trading Platform

> Universal instructions for Codex CLI, Claude Code, and other coding agents.
> Read this file first, then the docs in `docs/ai/`. Keep tool-specific behavior in
> `CLAUDE.md` or local agent config.

Evidence-based systematic trading platform. Turborepo monorepo, three apps, shared types,
and a Python engine that is validated separately from the Node workspaces.

## Read Order

1. `docs/ai/working-agreement.md`
2. `docs/ai/architecture.md`
3. `docs/ai/commands.md`
4. `docs/ai/review-checklist.md`
5. `docs/ai/state/project-state.md`
6. `docs/ai/agent-ops.md`
7. `CLAUDE.md` when using Claude Code

## Repository Map

```text
apps/web/        Next.js 16 dashboard (TypeScript, port 3000)
apps/engine/     Python FastAPI quant engine (port 8000)
apps/agents/     TypeScript agent orchestrator (port 3001)
packages/shared/ Shared TypeScript contracts (@sentinel/shared)
supabase/        PostgreSQL migrations and seed data
```

## Non-Negotiables

- Use a fresh branch or worktree for every scoped task. Do not share a branch between agents.
- One agent per file at a time. If a file is already in flight elsewhere, stop and coordinate.
- Every task and PR must state outcome, scope, validation, and forbidden changes.
- Do not change `package.json`, `pnpm-lock.yaml`, `turbo.json`, `vercel.json`, `.env.example`,
  `supabase/migrations/*`, or shared contracts without explicit scope.
- Web-to-engine requests must go through `apps/web/src/lib/engine-fetch.ts`. Do not add raw
  client-side engine URLs or auth headers ad hoc.
- Do not present fallback data as live data. Keep `OfflineBanner` and `SimulatedBadge` behavior intact.
- No secrets in code, docs, tests, fixtures, screenshots, or commits.
- Prefer minimal diffs. Do not refactor unrelated code while implementing a narrow task.

## Validation Rules

- `pnpm lint`, `pnpm test`, and `pnpm build` cover the Node/Turborepo workspaces only.
- Engine checks are separate. Use `pnpm lint:engine`, `pnpm format:check:engine`, and
  `pnpm test:engine`.
- Before handoff, list the exact commands you ran and whether they passed.
- If you change shared types, API contracts, env contracts, or migrations, validate every
  affected surface, not just the file you edited.

## Sensitive Paths

- `apps/web/src/lib/engine-fetch.ts`
- `apps/web/src/lib/engine-client.ts`
- `apps/engine/src/api/main.py`
- `apps/engine/src/config.py`
- `packages/shared/src/*`
- `supabase/migrations/*`
- `.github/workflows/ci.yml`

## Execution State

- Before editing files, read `docs/ai/state/project-state.md` and claim one ticket or explicitly note you are performing an untracked audit.
- Use `docs/ai/agent-ops.md` for the startup checklist, claim protocol, handoff format, and session priority order.
- Treat `docs/ai/state/project-state.md` as the live source of truth for task status. Do not create a competing status tracker in another file.

## Collaboration Defaults

- Engineering-control-plane PRs are gated by `Policy Verdict` plus the CI job checks
  defined in the protected-branch ruleset.
- Low-risk PRs can auto-merge after all required checks pass.
- Escalated PRs must receive the `decision/human-approved` label from the human owner
  before merge.
- Claude is best used for ambiguous debugging, architecture choices, and review.
- Codex is best used for isolated implementation, test additions, and mechanical changes.
- GitHub custom agents own PR classification, routing, and merge-policy summaries.
- Small tasks do not need a multi-step handoff; large or risky tasks do.
- CI is the final gate. Prompts and repo docs guide behavior, but passing checks decide merge readiness.
