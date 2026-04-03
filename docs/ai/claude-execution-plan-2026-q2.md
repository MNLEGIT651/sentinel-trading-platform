# Q2 2026 Execution Plan — Sentinel Trading Platform

_Created: 2026-04-03_

## Executive Summary

The Q2 2026 program hardens Sentinel from a functional prototype into a production-grade
trading platform. The work is organized into six sequential phases (A–F) targeting:

- **Trust & correctness** — every data point shows its provenance; no ambiguous live/simulated states.
- **Security boundaries** — auth, CSRF, rate limiting, and proxy hardening across all service edges.
- **Operational depth** — risk visibility, order lifecycle clarity, journal traceability.
- **Observability & release safety** — correlation IDs, SLO specs, and rollback runbooks.

All tickets live in [`docs/ai/claude-ticket-board-2026-q2.md`](claude-ticket-board-2026-q2.md).
Validation commands follow [`docs/ai/commands.md`](commands.md).

---

## Owners

| Role        | Responsibilities                                                              |
| ----------- | ----------------------------------------------------------------------------- |
| Human       | Product intent, security decisions, schema approval, merge authority, release |
| Claude Code | Architecture, review, debugging, decomposition, execution-plan maintenance    |
| Codex       | Isolated implementation, test additions, mechanical / repetitive changes      |

Ownership per ticket is claimed in [`docs/ai/state/project-state.md`](state/project-state.md).
One agent per ticket at a time; no shared branches between agents.

---

## Phase Map

### Phase A — Program Setup, Standards, and Governance

| Field       | Detail                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| **Goal**    | Establish execution plan, code standards, review checklist, and commands |
| **Tickets** | T-A01, T-A02, T-A03, T-A04                                               |
| **Entry**   | Q2 ticket board merged to `main`                                         |
| **Exit**    | All four docs committed, reviewed, and merged; `git diff --check` clean  |

### Phase B — Trust and Correctness (User-Facing Critical Path)

| Field       | Detail                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------ |
| **Goal**    | Unified data provenance across markets, portfolio, backtest; order form hardening          |
| **Tickets** | T-B01, T-B02, T-B03, T-B04, T-B05                                                          |
| **Entry**   | Phase A merged; code standards and review checklist available                              |
| **Exit**    | Provenance component + all page integrations pass targeted tests; order lifecycle reliable |

### Phase C — Security Boundary and Proxy Hardening

| Field       | Detail                                                                         |
| ----------- | ------------------------------------------------------------------------------ |
| **Goal**    | Harden auth boundaries, proxy semantics, CSRF, and rate limiting               |
| **Tickets** | T-C01, T-C02, T-C03                                                            |
| **Entry**   | Phase A review checklist (T-A03) merged                                        |
| **Exit**    | Auth boundary tests green; proxy edge cases covered; CSRF strategy implemented |

### Phase D — Risk, Journal, and Explainability Depth

| Field       | Detail                                                                            |
| ----------- | --------------------------------------------------------------------------------- |
| **Goal**    | Surface risk summaries, order error reasons, and journal-to-order linkage         |
| **Tickets** | T-D01, T-D02, T-D03                                                               |
| **Entry**   | T-B05 (order form hardening) merged                                               |
| **Exit**    | Risk UI renders with real data; error reasons displayed; journal linkage persists |

### Phase E — Agent Focus and Product Scope Discipline

| Field       | Detail                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| **Goal**    | Classify agent workflows, prune non-critical scope, harden advisor UX  |
| **Tickets** | T-E01, T-E02                                                           |
| **Entry**   | T-A01 execution plan merged                                            |
| **Exit**    | Workflows classified; advisor interaction resilience verified by tests |

### Phase F — Observability, SLOs, and Release Hardening

| Field       | Detail                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------- |
| **Goal**    | Correlation IDs, structured logging, SLO spec, and release/rollback runbook                 |
| **Tickets** | T-F01, T-F02, T-F03                                                                         |
| **Entry**   | T-C02 (proxy hardening) merged                                                              |
| **Exit**    | Correlation IDs in logs; SLO thresholds documented; release checklist blocks unsafe deploys |

---

## Decision Gates

Each gate is a go/no-go checkpoint between phases.

| Gate   | Between     | Go Criteria                                                                    |
| ------ | ----------- | ------------------------------------------------------------------------------ |
| G-AB   | A → B       | All governance docs merged; `pnpm lint` and `git diff --check` clean           |
| G-BC   | B → C       | Provenance component + page tests green; order polling reliable                |
| G-CD   | C → D       | Auth boundary + proxy + CSRF tests green; `pnpm test:web` passes               |
| G-DE   | D → E       | Risk UI, error mapping, and journal linkage tests green                        |
| G-EF   | E → F       | Workflow classification complete; advisor tests green                          |
| G-DONE | F → Release | All Phase F tickets merged; full validation suite green (see Release Criteria) |

Human owner makes the final go/no-go call at each gate. CI passing is necessary but not
sufficient — the human reviews risk notes and any open blockers in `project-state.md`.

---

## Release Criteria

The Q2 program is **done** when all of the following hold:

1. All 20 tickets (T-A01 through T-F03) are marked `done` in `project-state.md`.
2. `pnpm lint && pnpm test && pnpm build` — green.
3. `pnpm lint:engine && pnpm format:check:engine && pnpm test:engine` — green.
4. `node scripts/security-audit.mjs` — no new findings above baseline.
5. No open blockers in `project-state.md`.
6. Human sign-off on security-sensitive changes (auth, proxy, CSRF, migrations).
7. Release checklist (T-F03) completed with evidence of critical-path tests.

---

## Rollback Expectations

| Phase | Rollback Strategy                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------- |
| A     | Docs-only; revert commit or delete file. No runtime impact.                                        |
| B     | Feature-flag or revert provenance component. Existing pages degrade to pre-provenance state.       |
| C     | Revert proxy/auth changes per route. Health endpoint stays public. Roll back CSRF middleware.      |
| D     | Revert risk UI components. Order error mapping reverts to generic messages. Journal links removed. |
| E     | Revert workflow classification docs. Advisor UX reverts to prior state.                            |
| F     | Revert correlation-ID middleware. SLO docs are informational. Release checklist reverts.           |

General rule: every ticket branch is self-contained. Reverting a single merge commit undoes
exactly one ticket's scope. No cross-ticket coupling should exist within a phase.

---

## Risk Register

| #   | Risk                                         | Likelihood | Impact | Mitigation                                                                        |
| --- | -------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------- |
| R1  | Shared contract drift between web and engine | Medium     | High   | Validate both sides when `packages/shared` changes; CI catches type mismatches    |
| R2  | Auth boundary gaps after proxy hardening     | Low        | High   | Dedicated boundary tests in T-C01; review checklist gates auth flows              |
| R3  | Provenance component breaks existing pages   | Medium     | Medium | Unit tests per state; incremental page-by-page rollout (T-B02 → T-B04)            |
| R4  | Order lifecycle race conditions              | Medium     | High   | Polling tests in T-B05; terminal-state assertions; timeout handling               |
| R5  | Agent overlap on same file                   | Low        | Medium | One-ticket-one-branch rule; `project-state.md` claim protocol; no shared branches |

---

## Validation Baseline

All tickets reference the canonical commands in [`docs/ai/commands.md`](commands.md):

- **Docs-only tickets:** `git diff --check`
- **Web tickets:** `pnpm lint` + `pnpm test:web` + targeted test path + build when routing/config changes
- **Engine tickets:** `pnpm lint:engine` + `pnpm format:check:engine` + `pnpm test:engine`
- **Cross-app tickets:** full Node suite + engine suite + build
- **Security tickets:** above + `node scripts/security-audit.mjs`

Every handoff must list exact commands run, pass/fail status, and reason if any command was
skipped. See the [ticket board](claude-ticket-board-2026-q2.md) for per-ticket validation.

---

## Execution Order

```text
Phase A: T-A01 → T-A02 → T-A03 → T-A04
Phase B: T-B01 → T-B02 → T-B03 → T-B04 → T-B05
Phase C: T-C01 → T-C02 → T-C03
Phase D: T-D01 → T-D02 → T-D03
Phase E: T-E01 → T-E02
Phase F: T-F01 → T-F02 → T-F03
```

Phases B and C may overlap once their independent entry criteria are met (B needs T-A02;
C needs T-A03). Phases D and E have separate dependency chains and may also overlap.
Phase F requires Phase C completion.

---

_This plan is the canonical reference for the Q2 2026 hardening program. Update it here
when scope changes; do not create competing planning documents._
