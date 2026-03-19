# Sentinel Trading Platform — Claude Code Memory

This repository is a multi-app trading platform with shared TypeScript packages and Supabase-backed data flows.

## Project map

- `apps/web` — Next.js 16 trading dashboard and API routes.
- `apps/engine` — FastAPI quant engine, risk logic, strategies, and execution.
- `apps/agents` — agent orchestration service and approval workflow.
- `packages/shared` — shared TypeScript contracts.
- `supabase/` — schema migrations and seed data.
- `docs/ai/` — tool-neutral AI collaboration guidance.

Read these first for project-wide norms:

1. `docs/ai/working-agreement.md`
2. `docs/ai/architecture.md`
3. `docs/ai/commands.md`
4. `docs/ai/review-checklist.md`

## How Claude Code should operate here

- Prefer planning, debugging, architecture review, and careful refactors.
- Keep edits narrow and aligned to existing conventions.
- Do not silently change public API contracts across apps; update both sides and tests together.
- Treat market-data, brokerage, and secret-handling changes as high-risk.
- Prefer updating tests whenever behavior changes.

## Required workflow

- Create or follow a clear task scope before editing.
- Run the smallest relevant verification commands from `docs/ai/commands.md`.
- Surface blockers early when env vars or external services are required.
- Leave concise notes in PRs/commit messages about user-visible impact and risks.

## High-risk areas

- `apps/engine/src/api/routes/*`
- `apps/engine/src/execution/*`
- `apps/agents/src/server.ts`
- `apps/agents/src/recommendations-store.ts`
- `apps/web/src/app/api/*`
- `supabase/migrations/*`

For those areas: avoid broad refactors, preserve response shapes intentionally, and call out security or data-integrity implications explicitly.
