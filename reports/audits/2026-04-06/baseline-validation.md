# Baseline Validation Report

_Date: 2026-04-06_

## Environment

- Node: v24.14.1
- pnpm: 10.32.1
- Python: 3.12.3
- Branch: copilot/resolve-all-issues

## Validation Matrix

| Command                          | Result  | Duration | Notes                     |
| -------------------------------- | ------- | -------- | ------------------------- |
| `pnpm install --frozen-lockfile` | ✅ PASS | 12.7s    | All dependencies resolved |
| `pnpm lint`                      | ✅ PASS | 36.5s    | 3 packages, 0 errors      |
| `pnpm test`                      | ✅ PASS | 71.4s    | 1159 tests, 104 files     |
| `pnpm lint:engine`               | ✅ PASS | <5s      | All checks passed         |
| `pnpm format:check:engine`       | ✅ PASS | <5s      | 89 files formatted        |
| `pnpm test:engine`               | ✅ PASS | 3.7s     | 523 tests passed          |

## Security Audit

| Check                | Result     | Notes                                                           |
| -------------------- | ---------- | --------------------------------------------------------------- |
| Workflow permissions | ✅ PASS    | All workflows properly scoped                                   |
| npm audit (prod)     | ⚠️ BLOCKED | Registry returned 400 (Cloudflare)                              |
| pip-audit (engine)   | ⚠️ WARN    | pip 24.0 has CVE-2025-8869 and CVE-2026-1703 (not runtime deps) |

## Dead Code Analysis

| Category              | Count | Action                                            |
| --------------------- | ----- | ------------------------------------------------- |
| Unused shared exports | 13    | Clean up state-machine.ts and onboarding-state.ts |
| Unused scripts        | 1     | Remove sync-github-labels.mjs                     |
| Unused dependencies   | 0     | Clean                                             |
| Unused source files   | 0     | Clean                                             |

## Code Quality Findings

| Category                     | Count | Severity |
| ---------------------------- | ----- | -------- |
| Circuit breaker silent catch | 1     | Critical |
| Hardcoded values             | 3     | High     |
| Missing type hints           | 15+   | High     |
| Env contract drift           | 3     | High     |
| Error handling gaps          | 8     | Medium   |
| Accessibility issues         | 1     | Medium   |
