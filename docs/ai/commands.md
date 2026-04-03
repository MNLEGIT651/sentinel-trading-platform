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

> **Note:** Scoped test runs (e.g., `pnpm --filter web test -- --run tests/unit/specific.test.ts`)
> are acceptable for narrow tickets, but critical-path tickets (any T-B\*, T-C\*, T-D\*) must also
> run the full area test suite (`pnpm test:web` for web, `pnpm test:engine` for engine).

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
- CI `security-audit` gate runs after `test-web`, `test-engine`, and `test-agents` on:
  - pushes to `main`
  - pull requests targeting `main` or `release/*` branches
- State clearly what you could not verify locally

## Handoff Format

When reporting validation, always include:

- exact command
- pass/fail
- if skipped, why it was skipped

## Command Subsets by Ticket Type

Each ticket type has a required minimum set of validation commands. Run at least these
commands before handing off work.

| Ticket Type                     | Required Commands                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Docs-only (T-A\*, T-F02, T-F03) | `git diff --check`                                                                                                                   |
| Web UI (T-B\*, T-D01, T-D02)    | `pnpm lint`, `pnpm test:web`, `pnpm --filter @sentinel/web build` (if routing/config changed)                                        |
| Web + API (T-B05, T-D03, T-E02) | `pnpm lint`, `pnpm test:web`, `pnpm --filter @sentinel/web build`                                                                    |
| Security/Proxy (T-C\*)          | `pnpm lint`, `pnpm --filter web test -- --run tests/unit/api-proxy-routes.test.ts tests/unit/service-proxy.test.ts`, `pnpm test:web` |
| Engine-touching (T-F01)         | `pnpm lint`, `pnpm test:web`, `pnpm test:engine`, `pnpm lint:engine`                                                                 |
| Agent (T-E01)                   | `pnpm --filter agents test`, `git diff --check`                                                                                      |
| Cross-cutting                   | `pnpm lint`, `pnpm test`, `pnpm test:engine`, `pnpm build`                                                                           |

When a ticket spans multiple types, use the union of all applicable command sets.

## Pass/Fail Reporting Format

Every handoff MUST include validation results in this exact format:

```
## Validation Results

| Command | Result | Notes |
|---------|--------|-------|
| `pnpm lint` | ✅ PASS | No warnings |
| `pnpm test:web` | ✅ PASS | 90 tests, 0 failures |
| `pnpm --filter @sentinel/web build` | ⏭️ SKIPPED | No routing/config changes |

### Skipped Validations
- `pnpm --filter @sentinel/web build` — Not required: docs-only change with no routing or config modifications.
```

Use ✅ PASS, ❌ FAIL, or ⏭️ SKIPPED as the result value. Always include a reason
for skipped commands in the "Skipped Validations" subsection.
