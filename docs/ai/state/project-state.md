# Project State Ledger

_Last updated: 2026-03-20_

This is the live status board for Claude Code, Codex, and human collaborators.

## Current priority program

Deployment simplification + root README + agent coordination system.

Canonical roadmap:
- `docs/ai/roadmaps/2026-03-20-deployment-readme-roadmap.md`

## Session startup checklist

Before editing files:
- [ ] Read `AGENTS.md`
- [ ] Read `docs/ai/working-agreement.md`
- [ ] Read `docs/ai/architecture.md`
- [ ] Read `docs/ai/commands.md`
- [ ] Read `docs/ai/review-checklist.md`
- [ ] Read this file
- [ ] Claim one ticket below
- [ ] Confirm no overlapping file ownership

---

## Queue

| Ticket | Status | Owner | Branch/Worktree | Scope | Validation | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1.1 | queued | unassigned | _n/a_ | `docs/ai/state/project-state.md` | `git diff --check` | 2026-03-20 | Create and maintain the canonical live task ledger. |
| T1.2 | queued | unassigned | _n/a_ | `docs/ai/agent-ops.md` | `git diff --check` | 2026-03-20 | Define startup, claim, and handoff rules for Claude + Codex. |
| T1.3 | queued | unassigned | _n/a_ | `AGENTS.md` | `git diff --check` | 2026-03-20 | Link new control-plane docs from repo-level instructions. |
| T2.1 | queued | unassigned | _n/a_ | `docs/deployment.md` | `git diff --check` | 2026-03-20 | Write the canonical deployment architecture doc. |
| T2.2 | queued | Human | _n/a_ | `docs/deployment.md`, this file | human decision review | 2026-03-20 | Decide whether `agents` is required or optional for first production deployment. |
| T2.3 | queued | unassigned | _n/a_ | `docs/deployment.md`, `.env.example` | `git diff --check` | 2026-03-20 | Add environment ownership and exposure matrix. |
| T3.1 | queued | unassigned | _n/a_ | analysis artifact or this file | `git diff --check` | 2026-03-20 | Inventory browser calls that still hit engine or agents directly. |
| T3.2 | queued | unassigned | _n/a_ | `apps/web/src/app/api/**`, `apps/web/src/app/page.tsx`, tests | `pnpm lint`; `pnpm test:web`; `pnpm --filter @sentinel/web build` | 2026-03-20 | Route engine-backed dashboard calls through same-origin web endpoints. |
| T3.3 | queued | unassigned | _n/a_ | `apps/web/src/app/api/**`, `apps/web/src/hooks/use-service-health.ts`, `apps/web/src/app/page.tsx`, tests | `pnpm lint`; `pnpm test:web`; `pnpm --filter @sentinel/web build` | 2026-03-20 | Route agents-backed flows through same-origin endpoints or disable for first production. |
| T3.4 | queued | unassigned | _n/a_ | `apps/web/src/lib/server/service-config.ts`, callers, tests | `pnpm lint`; `pnpm test:web`; `pnpm --filter @sentinel/web build` | 2026-03-20 | Centralize service URL/auth/timeout logic. |
| T4.1 | queued | unassigned | _n/a_ | Dockerfiles, `docs/deployment.md` | Docker build checks if touched | 2026-03-20 | Audit and normalize container assets against the canonical topology. |
| T4.2 | queued | unassigned | _n/a_ | `docs/deployment.md`, `README.md` | `git diff --check` | 2026-03-20 | Align Vercel, Railway, and Compose docs into one story. |
| T4.3 | queued | unassigned | _n/a_ | `docs/runbooks/*.md` | `git diff --check` | 2026-03-20 | Add local, production, and troubleshooting runbooks. |
| T5.1 | queued | unassigned | _n/a_ | `README.md` | `git diff --check` | 2026-03-20 | Create root README skeleton. |
| T5.2 | queued | unassigned | _n/a_ | `README.md` | `git diff --check` | 2026-03-20 | Add architecture, commands, repo map, and validation sections. |
| T5.3 | queued | unassigned | _n/a_ | `README.md`, `docs/deployment.md` | `git diff --check` | 2026-03-20 | Add deployment/env sections with links to deeper docs. |
| T5.4 | queued | unassigned | _n/a_ | `README.md` | `git diff --check` | 2026-03-20 | Add maturity, known gaps, and roadmap summary. |

---

## Active work log

| Ticket | Status | Owner | Branch/Worktree | Scope | Validation | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T0 | done | Codex | `work` | `docs/ai/roadmaps/2026-03-20-deployment-readme-roadmap.md`, `docs/ai/agent-ops.md`, `docs/ai/state/project-state.md` | `git diff --check` | 2026-03-20 | Seeded roadmap, operating guide, and state ledger requested by user. |

---

## Blockers / decisions needed

| ID | Owner | Decision | Impact | Last Updated |
| --- | --- | --- | --- | --- |
| D1 | Human | Should first production require `agents`, or should `agents` be optional? | Determines T2.2, T3.3, deployment docs, and README wording. | 2026-03-20 |
| D2 | Human | Preferred production hosting pair: Vercel + Railway, Vercel + Docker host, or full container host? | Determines deployment doc recommendations and runbook examples. | 2026-03-20 |

---

## Update rules

When you claim a ticket:
1. Move it from `queued` to `active`.
2. Fill in owner, branch/worktree, exact scope, and last updated date.
3. Do not start editing until the claim is written here.

When you finish a ticket:
1. Mark it `done`.
2. Add a one-line summary of what changed.
3. Record exact validation commands and status in the handoff/PR.
