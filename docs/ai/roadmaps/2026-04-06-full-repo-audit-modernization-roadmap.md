# Full-Repo Audit & Modernization Roadmap

_Created: 2026-04-06_

## Overview

Evidence-based audit program covering code quality, dependencies, tests, CI/CD, security, docs,
and deployment readiness across the Sentinel trading platform monorepo.

## Phase Map

| Phase | Title                                 | Scope                                           | Status |
| ----- | ------------------------------------- | ----------------------------------------------- | ------ |
| 0     | Program Setup and Baseline            | Roadmap, baseline reports, validation matrix    | Done   |
| 1     | Dependency and Platform Modernization | Safe dependency upgrades, pip vulnerability     | Done   |
| 2     | Dead Code and Repo Hygiene            | Unused scripts, exports, stale docs             | Done   |
| 3     | Web Audit                             | Hardcoded values, error handling, accessibility | Done   |
| 4     | Agents and Engine Audit               | Circuit breaker, env contract, type hints       | Done   |
| 5     | Shared Contracts, Persistence, CI/CD  | Cross-surface validation, shared exports        | Done   |
| 6     | Final Verification and Closeout       | Full validation matrix, residual backlog        | Done   |

## Baseline Validation Results (2026-04-06)

| Command                           | Result     | Details                                                                            |
| --------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `pnpm lint`                       | ✅ PASS    | 3 tasks, 0 errors                                                                  |
| `pnpm test`                       | ✅ PASS    | 1159 tests, 104 files, 3 packages                                                  |
| `pnpm lint:engine`                | ✅ PASS    | All checks passed                                                                  |
| `pnpm format:check:engine`        | ✅ PASS    | 89 files formatted                                                                 |
| `pnpm test:engine`                | ✅ PASS    | 523 tests passed                                                                   |
| `node scripts/security-audit.mjs` | ⚠️ PARTIAL | Workflow permissions pass; npm audit blocked by registry; pip-audit found pip CVEs |

## Key Findings

### Critical

- Circuit breaker in engine has `except Exception: pass` (silent failure)
- Agents env contract missing `ENGINE_URL` and `WEB_URL` from required vars

### High

- Hardcoded IP `0.0.0.0` in KYC form
- Hardcoded sitemap URL (should use env var)
- Missing Python return type hints on ~15 indicator functions
- `Record<string, unknown>` used broadly in agents workflows

### Medium

- Unused script: `scripts/sync-github-labels.mjs`
- 13 unused exports in `packages/shared/src/` (state-machine, onboarding-state)
- Silent MFA unenroll error catch in security settings
- Notification center accessibility gap (clickable div without ARIA)
- KYC form error handling incomplete

### Low

- Type assertion bypasses (`as unknown as`) in 2 API routes
- Console warnings in KYC form lack error details

## Execution Strategy

Each phase produces evidence-backed changes with targeted validation.
No behavioral changes without test coverage.
No shared contract or schema changes without cross-surface validation.
