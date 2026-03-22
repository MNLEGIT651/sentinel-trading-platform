# AI Commands

These are the canonical validation commands for this repo.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in required Supabase, Polygon, Alpaca, engine, and agents values.
3. Ensure the engine virtualenv exists at `apps/engine/.venv`.

## Canonical Root Commands

```bash
pnpm dev                # Start Node workspaces through Turborepo
pnpm lint               # Lint/typecheck Node workspaces only
pnpm test               # Test Node workspaces only
pnpm build              # Build Node workspaces only
node scripts/security-audit.mjs  # Workflow permissions + dependency audit; requires apps/engine/.venv with pip-audit
pnpm test:web           # Web Vitest suite
pnpm test:web:e2e       # Web Playwright suite
pnpm test:agents        # Agents Vitest suite
pnpm lint:engine        # Ruff lint for the Python engine
pnpm format:check:engine  # Ruff format check for the Python engine
pnpm test:engine        # Engine pytest suite
```

Important: `pnpm lint`, `pnpm test`, and `pnpm build` do not cover `apps/engine`.

## Area-Based Validation

### Docs Only

- `git diff --check`

### Web

- `pnpm lint`
- `pnpm test:web`
- `pnpm --filter @sentinel/web build` when routing, data fetching, or config changed

### Agents

- `pnpm lint`
- `pnpm test:agents`

### Engine

- `pnpm lint:engine`
- `pnpm format:check:engine`
- `pnpm test:engine`

### Shared Types Or Cross-App Contracts

- `pnpm lint`
- `pnpm test`
- `pnpm test:engine` if the contract is used by the engine-facing flows
- `pnpm --filter @sentinel/web build` when the web app is affected

### CI Or Workflow Changes

- `git diff --check`
- Run the closest local command to the workflow steps you changed
- `node scripts/security-audit.mjs` when workflow permissions or dependency-audit automation changes
- State clearly what you could not verify locally

## Handoff Format

When reporting validation, always include:

- exact command
- pass/fail
- if skipped, why it was skipped
