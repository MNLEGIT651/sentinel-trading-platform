# Sentinel Trading Platform — AGENTS.md

This file is the repository-wide contract for coding agents working in this repo.

## Mission

Ship safe, reviewable improvements to the Sentinel trading platform without breaking cross-app contracts between:

- `apps/web`
- `apps/engine`
- `apps/agents`
- `packages/shared`
- `supabase`

## Read before editing

1. `docs/ai/working-agreement.md`
2. `docs/ai/architecture.md`
3. `docs/ai/commands.md`
4. `docs/ai/review-checklist.md`

## Repo rules

- Keep changes scoped to the task.
- Do not rewrite unrelated files.
- Preserve behavior by default; if behavior changes, update tests and document the reason.
- When changing API contracts, update every affected client and test in the same task.
- Never commit secrets or real credentials.
- Treat Supabase migrations, brokerage logic, and order execution paths as high risk.

## Collaboration model

- Claude Code is best used for planning, diagnosis, and architecture-sensitive edits.
- Codex is best used for isolated implementation, tests, and PR-oriented tasks.
- Do not have multiple agents edit the same branch or same file set at the same time.
- Prefer one issue -> one branch -> one PR.

## Validation expectations

Run the smallest relevant checks for touched areas. Examples live in `docs/ai/commands.md`.

At minimum, try to run:

- targeted tests for changed modules,
- lint/type checks where applicable,
- a quick runtime smoke check for user-facing changes.

If env or network limitations block validation, state that clearly.

## Documentation expectations

If you add or change workflow, architecture, or team conventions, update the corresponding file in `docs/ai/`.
