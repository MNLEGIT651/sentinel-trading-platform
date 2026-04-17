# Sentinel Trading Platform — Claude Code

> Read `AGENTS.md` first, then `docs/ai/working-agreement.md`. This file adds Claude Code-specific
> context for the Sentinel repo and should stay thin.

## Claude Role

- Prefer Claude for repo understanding, root-cause analysis, architecture discussion, and final review.
- For implementation, keep scope narrow and follow the branch/worktree rules in `docs/ai/working-agreement.md`.
- If a task touches shared contracts, migrations, auth, or deployment config, stop and restate the risk
  before editing.

## Claude-Specific Context

- Health polling: `useServiceHealth` hook in AppShell polls engine + agents every 15s, writes to Zustand
- Engine auth: All client-side engine calls must use `engineUrl()` / `engineHeaders()` from `lib/engine-fetch.ts`
- Settings page has no API key form — keys are configured via `.env` only
- The `EngineClient` class in `lib/engine-client.ts` is the server-side SDK (used by agents app); pages use `engine-fetch.ts`

## Claude Repo Assets

- Reusable project skills live in `.claude/skills/`. Check for an existing Sentinel skill before inventing a new workflow.
- Permissions live in `.claude/settings.json`. Keep permissions narrow and project-specific.

## Lightweight Hooks + Contract Guardian

- `.claude/settings.json` includes lightweight hooks: after edit/write actions it runs a dry-run scope check and prints a warning if high-risk contract paths are touched; at stop it prints a final `pnpm pre-pr` reminder and runs `git diff --check`.
- Invoke `.claude/agents/contract-guardian.md` for read-only review whenever a task touches shared contracts, proxy/auth boundaries, engine config, or migrations.
- These hooks/subagent are guardrails only — they do not replace `AGENTS.md` requirements.

## Commands (Quick Reference)

See `docs/ai/commands.md` for the full matrix. Most common:

```bash
pnpm lint
pnpm test
pnpm test:engine
```

## Tech Stack

See `docs/ai/architecture.md` for the repo map. Key detail: Python version is 3.12+.

## Environment

See `docs/ai/commands.md`. Copy `.env.example` to `.env` and fill in credentials before
running live flows.
