# Sentinel Trading Platform — Claude Code

> **Read and follow `AGENTS.md` first.** It contains the universal project instructions
> (architecture, commands, conventions, coding standards) shared with all AI agents.
> This file adds Claude Code-specific configuration only.

## Claude-Specific Context

- Health polling: `useServiceHealth` hook in AppShell polls engine + agents every 15s, writes to Zustand
- Engine auth: All client-side engine calls must use `engineUrl()` / `engineHeaders()` from `lib/engine-fetch.ts`
- Settings page has no API key form — keys are configured via `.env` only
- The `EngineClient` class in `lib/engine-client.ts` is the server-side SDK (used by agents app); pages use `engine-fetch.ts`

## Commands (Quick Reference)

See `AGENTS.md` for full list. Most common:

```bash
pnpm test                   # Web tests (94 tests)
cd apps/engine && .venv/Scripts/python -m pytest   # Engine tests (242 tests)
```

## Tech Stack

See `AGENTS.md` for full table. Key detail: Python version is 3.12+ (not 3.14).

## Environment

See `AGENTS.md`. Copy `.env.example` to `.env` and fill in credentials.
