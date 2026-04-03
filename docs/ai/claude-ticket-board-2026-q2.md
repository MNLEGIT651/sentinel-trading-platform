# Claude Code Ticket Board — Q2 2026 Execution

_Created: 2026-04-03_

Purpose: a production-grade, atomic ticket board for Claude Code Opus 4.6 to execute the Sentinel hardening and delivery plan with clear scope, dependencies, acceptance criteria, and validation commands.

## Operating Rules (apply to every ticket)

- Follow `AGENTS.md` non-negotiables.
- Claim exactly one ticket at a time in `docs/ai/state/project-state.md`.
- Keep diffs minimal and scoped.
- Do not present simulated/fallback data as live.
- Do not modify restricted files unless ticket scope explicitly includes them.
- Report exact command outputs and pass/fail status in each handoff.

## Validation Baseline

- Node workspaces: `pnpm lint`, `pnpm test`, `pnpm build`
- Engine: `pnpm lint:engine`, `pnpm format:check:engine`, `pnpm test:engine`
- Scoped runs are allowed for narrow tickets, but critical-path tickets must include targeted tests for changed behavior.

---

## Phase A — Program Setup, Standards, and Governance

### T-A01 — Execution plan scaffold

- **Outcome:** Canonical execution plan doc with phase map, owners, and release criteria.
- **Scope:** `docs/ai/claude-execution-plan-2026-q2.md`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Defines all phases and decision gates.
  - Defines done criteria and rollback expectations.
- **Validation:**
  - `git diff --check`

### T-A02 — Code standards doc

- **Outcome:** Written standards for TypeScript, Python, auth, error handling, logging, and testing.
- **Scope:** `docs/ai/code-standards.md`
- **Dependencies:** T-A01
- **Acceptance Criteria:**
  - Includes explicit “no silent catch” and “typed API errors” rules.
  - Includes security-sensitive logging/redaction rules.
- **Validation:**
  - `git diff --check`

### T-A03 — Review checklist upgrade

- **Outcome:** Review checklist enforces critical-path quality gates.
- **Scope:** `docs/ai/review-checklist.md`
- **Dependencies:** T-A02
- **Acceptance Criteria:**
  - Adds mandatory checks for auth/proxy/order/data provenance flows.
  - Adds explicit skip-with-reason policy for validation commands.
- **Validation:**
  - `git diff --check`

### T-A04 — Commands doc alignment

- **Outcome:** `docs/ai/commands.md` updated with targeted critical-path commands.
- **Scope:** `docs/ai/commands.md`
- **Dependencies:** T-A03
- **Acceptance Criteria:**
  - Defines required command subsets per ticket type.
  - Includes expected pass/fail reporting format.
- **Validation:**
  - `git diff --check`

---

## Phase B — Trust and Correctness (User-Facing Critical Path)

### T-B01 — Unified data provenance component

- **Outcome:** Shared provenance indicator for Live/Cached/Simulated/Offline states.
- **Scope:** `apps/web/src/components/ui/` (new component), related tests
- **Dependencies:** T-A02
- **Acceptance Criteria:**
  - Reusable component with deterministic rendering per mode.
  - Unit tests for all states.
- **Validation:**
  - `pnpm --filter web test -- --run tests/components`

### T-B02 — Markets provenance and freshness wiring

- **Outcome:** Markets page explicitly shows data source and freshness metadata.
- **Scope:** `apps/web/src/app/(dashboard)/markets/page.tsx`, query hooks/tests
- **Dependencies:** T-B01
- **Acceptance Criteria:**
  - No ambiguous live/simulated representation.
  - Stale data warning shown after threshold.
- **Validation:**
  - `pnpm --filter web test -- --run tests/pages/markets.test.tsx`

### T-B03 — Portfolio provenance and status clarity

- **Outcome:** Portfolio reflects live/cached/simulated account and quote state.
- **Scope:** `apps/web/src/app/(dashboard)/portfolio/page.tsx`, related tests
- **Dependencies:** T-B01
- **Acceptance Criteria:**
  - Provenance visible in portfolio header and/or metrics card.
  - Empty-state messaging matches actual data mode.
- **Validation:**
  - `pnpm --filter web test -- --run tests/pages/portfolio.test.tsx`

### T-B04 — Backtest provenance and fallback transparency

- **Outcome:** Backtest clearly indicates engine vs synthetic execution.
- **Scope:** `apps/web/src/app/(dashboard)/backtest/page.tsx`, related tests
- **Dependencies:** T-B01
- **Acceptance Criteria:**
  - Fallback runs are labeled simulated.
  - Engine failures produce explicit user-facing explanation.
- **Validation:**
  - `pnpm --filter web test -- --run tests/pages/backtest.test.tsx`

### T-B05 — Order form hardening (types + TIF + lifecycle)

- **Outcome:** Quick order supports full payload and deterministic terminal-state handling.
- **Scope:** `apps/web/src/app/(dashboard)/portfolio/page.tsx`, `apps/web/src/hooks/queries/*order*`, tests
- **Dependencies:** T-B03
- **Acceptance Criteria:**
  - `order_type` and `time_in_force` supported.
  - Pending/polling/terminal transitions are reliable.
- **Validation:**
  - `pnpm --filter web test -- --run tests/hooks/use-order-polling.test.ts tests/pages/portfolio.test.tsx`

---

## Phase C — Security Boundary and Proxy Hardening

### T-C01 — Engine proxy auth boundary tests

- **Outcome:** Expanded tests for unauthorized, session expiry, and passthrough semantics.
- **Scope:** `apps/web/tests/unit/api-proxy-routes.test.ts`, `apps/web/src/app/api/engine/[...path]/route.ts`
- **Dependencies:** T-A03
- **Acceptance Criteria:**
  - Auth failures return explicit 401 contract.
  - Health route remains public by policy.
- **Validation:**
  - `pnpm --filter web test -- --run tests/unit/api-proxy-routes.test.ts`

### T-C02 — Service proxy retry/body-limit regression tests

- **Outcome:** Body cap, retry exhaustion, and status mapping covered.
- **Scope:** `apps/web/src/lib/server/service-proxy.ts`, unit tests
- **Dependencies:** T-C01
- **Acceptance Criteria:**
  - 413 behavior verified.
  - Retryable/non-retryable paths covered.
- **Validation:**
  - `pnpm --filter web test -- --run tests/unit/service-proxy.test.ts`

### T-C03 — CSRF and rate-limit hardening ticket

- **Outcome:** Web-tier protection strategy implemented for state-changing routes.
- **Scope:** selected `apps/web/src/app/api/**` mutating routes + tests + docs
- **Dependencies:** T-C01
- **Acceptance Criteria:**
  - Mutating routes enforce CSRF strategy.
  - Rate-limited response semantics documented and tested.
- **Validation:**
  - `pnpm --filter web test`
  - `pnpm lint`

---

## Phase D — Risk, Journal, and Explainability Depth

### T-D01 — Portfolio risk summary UI

- **Outcome:** Risk summary card(s) on portfolio risk tab.
- **Scope:** `apps/web/src/components/portfolio/*`, `apps/web/src/app/(dashboard)/portfolio/page.tsx`
- **Dependencies:** T-B05
- **Acceptance Criteria:**
  - Displays concentration and sizing/risk hints using existing backend data.
  - Handles no-data and error states cleanly.
- **Validation:**
  - `pnpm --filter web test -- --run tests/components/portfolio`

### T-D02 — Order error reason mapping from engine

- **Outcome:** Risk-block and validation failure reasons surfaced in UI.
- **Scope:** order hooks + portfolio UI + tests
- **Dependencies:** T-D01
- **Acceptance Criteria:**
  - 422 risk-block reason displayed verbatim-safe and actionable.
  - Other known statuses map to user guidance text.
- **Validation:**
  - `pnpm --filter web test -- --run tests/pages/portfolio.test.tsx`

### T-D03 — Journal linkage to order/recommendation lifecycle

- **Outcome:** Journal entries trace to recommendation/order IDs where available.
- **Scope:** `apps/web/src/app/api/journal/*`, `apps/web/src/app/(dashboard)/journal/page.tsx`, tests
- **Dependencies:** T-D02
- **Acceptance Criteria:**
  - Linkage fields persist and render in UI.
  - Auth boundaries remain enforced.
- **Validation:**
  - `pnpm --filter web test -- --run tests/pages/journal.test.tsx tests/unit/*journal*`

---

## Phase E — Agent Focus and Product Scope Discipline

### T-E01 — Workflow classification and roadmap pruning

- **Outcome:** Agent workflows classified as user-facing vs internal operations.
- **Scope:** `apps/agents/workflows/*.md`, docs state/plan files
- **Dependencies:** T-A01
- **Acceptance Criteria:**
  - Non-product-critical workflows explicitly deprioritized in roadmap/state docs.
  - No breaking runtime behavior introduced.
- **Validation:**
  - `pnpm --filter agents test -- --run tests/workflows`
  - `git diff --check`

### T-E02 — Advisor interaction reliability pass

- **Outcome:** Advisor thread/message UX resilience improved.
- **Scope:** `apps/web/src/app/(dashboard)/advisor/page.tsx`, advisor hooks/routes/tests
- **Dependencies:** T-E01
- **Acceptance Criteria:**
  - Clear loading/error/retry states in conversations.
  - Thread selection/back-navigation state is robust.
- **Validation:**
  - `pnpm --filter web test -- --run tests/pages/advisor.test.tsx tests/unit/advisor-*`

---

## Phase F — Observability, SLOs, and Release Hardening

### T-F01 — Correlation ID and structured log audit pass

- **Outcome:** Critical-path requests include traceable IDs and structured logs.
- **Scope:** web proxy + engine route touchpoints + docs
- **Dependencies:** T-C02
- **Acceptance Criteria:**
  - Correlation IDs visible across boundary logs.
  - Error logs include machine-parseable fields.
- **Validation:**
  - `pnpm --filter web test -- --run tests/unit/service-proxy.test.ts`
  - `pnpm test:engine`

### T-F02 — Critical-path SLO dashboard spec

- **Outcome:** Operational SLO spec documented with thresholds and alert paths.
- **Scope:** `docs/runbooks/` + `docs/ai/`
- **Dependencies:** T-F01
- **Acceptance Criteria:**
  - Defines p95 latency, auth error rate, order failure rate, stale-data rate.
  - Defines escalation/incident response path.
- **Validation:**
  - `git diff --check`

### T-F03 — Release readiness and rollback runbook

- **Outcome:** Release checklist upgraded to block unsafe deploys.
- **Scope:** `docs/runbooks/release-checklist.md`, `docs/ai/review-checklist.md`
- **Dependencies:** T-F02
- **Acceptance Criteria:**
  - Includes go/no-go criteria and rollback commands.
  - Requires evidence of critical-path tests.
- **Validation:**
  - `git diff --check`

---

## Execution Order

1. T-A01 → T-A04
2. T-B01 → T-B05
3. T-C01 → T-C03
4. T-D01 → T-D03
5. T-E01 → T-E02
6. T-F01 → T-F03

## Per-Ticket Handoff Template

- Ticket ID:
- Outcome:
- Files changed:
- Validation commands + pass/fail:
- Risk/rollback notes:
- Follow-up ticket recommendation:
