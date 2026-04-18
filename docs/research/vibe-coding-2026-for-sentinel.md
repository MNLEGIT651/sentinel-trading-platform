# Vibe Coding 2026 for Sentinel

Decision record for how Sentinel structures AI-assisted development.
Canonical summary of the April 2026 research audit. This file is durable
policy context, not a live work tracker.

See also: `AGENTS.md`, `CLAUDE.md`, `docs/ai/working-agreement.md`,
`docs/playbooks/repo-aware-ai-coding-playbook.md`,
`docs/playbooks/contract-safe-change-playbook.md`.

## Scope

This document captures:

- Why Sentinel's AI workflow looks the way it does.
- What the 2026 tooling landscape established as durable practice.
- Which patterns we adopted, deferred, or rejected.

It does not duplicate `AGENTS.md` or `CLAUDE.md`. Those files are the
enforceable policy; this file is the "why" behind the policy.

## Repo Profile

Sentinel is a multi-service monorepo:

- `apps/web` — Next.js App Router on Vercel.
- `apps/engine` — Python FastAPI quant engine on Railway.
- `apps/agents` — TypeScript orchestrator on Railway.
- `packages/shared` — shared TypeScript contracts.
- `supabase/` — PostgreSQL migrations and seed data.

Key boundary properties:

- The browser talks only to the Next.js origin; backend calls are proxied
  through same-origin route handlers (`apps/web/src/proxy.ts` +
  `apps/web/src/lib/engine-fetch.ts`).
- SSR Supabase auth with `getClaims()` in server code.
- Shared contracts flow web ↔ agents via `packages/shared`.
- Node and Python are validated on separate pipelines
  (`pnpm lint` / `pnpm test` vs `pnpm lint:engine` / `pnpm test:engine`).

These boundaries are the actual risk surface. The AI workflow is designed
around preserving them, not around maximizing agent autonomy.

## Durable 2026 Trends Adopted

1. **Persistent project-scoped instructions.** One shared repo policy
   (`AGENTS.md`) with thin tool-specific projections (`CLAUDE.md`,
   `.github/copilot-instructions.md`). Mutable state lives elsewhere.
2. **Hooks at the edge of the agent loop.** `PostToolUse` warns on
   high-risk path touches; `Stop` runs `validate:changed` at session end.
   Rules are executable, not only prose.
3. **Specialized subagents.** `contract-guardian` (Read/Grep/Glob only)
   reviews contract-risk changes before edits land.
4. **Changed-scope validation.** `scripts/validate-changed-scope.mjs` runs
   the minimum correct validation set per area. Full `pnpm pre-pr`
   remains the merge gate.
5. **GitHub-native coordination.** Issue assignment + PR linkage is the
   authoritative live coordination surface. `project-state.md` is a
   secondary summary view.
6. **Role-based tool stack.** Claude for investigation/decomposition/
   review; Codex for bounded implementation; Copilot coding agent for
   issue-to-PR delegation inside GitHub.

## Trends Deferred

- **Turbo remote cache + artifact signing.** Worth enabling for `build`
  and `typecheck` once cache-token and CI policy decisions are made.
  Keep tests uncached.
- **Web route-handler observability.** `console.error` in
  `apps/web/src/app/api/**` should be replaced with the structured
  logger, and Sentry should be wired in. Tracked separately.
- **Broader autonomous cloud agents.** Monitor GitHub Agent HQ and
  Codex app multi-agent features; adopt only when an approval model
  fits our boundary discipline.

## Patterns Rejected

- **`middleware.ts` for the web layer.** Replaced by `proxy.ts` under
  Next.js 16. Coexistence is rejected by the framework.
- **Browser-facing backend env vars.** Backend URLs stay server-side;
  same-origin proxy is policy.
- **`.cursorrules` or equivalent tool-local-only rule files as the
  source of truth.** Shared policy lives in `AGENTS.md`.
- **Markdown claim registries as real-time locks.**
  `project-state.md` is a summary, not a lock file.
- **Single-agent ownership of discovery → implementation → validation →
  review in one uninterrupted run.** Sentinel's boundary surface is too
  sensitive; structured handoff is required.

## Why The Policy Is Restrictive

Sentinel's expensive failures are boundary failures: bypassing the
web-to-engine trust boundary, shared-contract drift across web and agents,
weakening SSR auth, mislabeling simulated/offline states, conflating Node
and engine validation. The restrictions in `AGENTS.md` (≤20 file PRs,
one-agent-per-file, worktree isolation, stop-and-ask paths) are
proportionate to that risk surface, not to beginner risk.

## How To Use This Document

- Reference it in PR descriptions when a decision needs context ("we
  route all engine calls through `engine-fetch.ts` because …").
- Update it when a durable policy changes — not when a task ships.
- Keep it short. Longer prose belongs in `docs/playbooks/` or
  `docs/ai/`; live status belongs on GitHub issues/PRs.
