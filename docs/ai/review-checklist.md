# AI Review Checklist

Use this before opening a PR or handing work back to another agent.

## Scope Discipline

- The diff matches the requested outcome.
- Files outside the stated scope were not changed without explanation.
- Shared config, migrations, or contracts were not changed accidentally.

## Repo-Specific Correctness

- Web client calls to the engine still use `engineUrl()` and `engineHeaders()`.
- Engine auth expectations around `ApiKeyMiddleware` were preserved unless the task explicitly changed them.
- Offline states still surface through `OfflineBanner` when needed.
- Simulated or fallback data still uses `SimulatedBadge`.
- Settings flows did not introduce API key entry in the UI.

## Validation

- The commands from `docs/ai/commands.md` were run for every changed area.
- The PR or handoff message lists exact commands and results.
- CI changes are mirrored by a local validation attempt when practical.

## Review Readiness

- Risky assumptions are called out.
- New or changed behavior is covered by tests when appropriate.
- Docs were updated if commands, contracts, or workflow rules changed.
- No secrets, tokens, or local machine paths leaked into the diff.

## Critical-Path Quality Gates

These checks are mandatory for any PR touching the corresponding area.

### Auth/Proxy Flows

- JWT validation logic is intact and has not been weakened.
- `requireAuth()` is not bypassed or short-circuited in any route that previously required it.
- Proxy routes forward credentials correctly to the upstream service.
- The engine health route (`/api/engine/health`) remains public by policy.

### Order/Trading Flows

- Order mutations validate input (symbol, qty, order_type, time_in_force) before submission.
- Error states from the engine or broker surface to the user with actionable messaging.
- Polling lifecycle handles all terminal states (filled, canceled, expired, rejected) and stops cleanly.
- Risk checks are not bypassed or silently swallowed.

### Data Provenance Flows

- `SimulatedBadge` is shown whenever fallback or synthetic data is displayed.
- `OfflineBanner` is shown when the engine is unreachable.
- No synthetic or cached data is presented as live without an explicit provenance indicator.
- Freshness metadata (e.g., last-updated timestamp) is displayed where available.

### Journal/Audit Flows

- Journal entries are created for decision-impacting events (order placed, recommendation acted on, risk override).
- `user_id` filtering is enforced on all journal queries — no cross-user data leakage.

## Skip-With-Reason Policy

Any validation command from `docs/ai/commands.md` may be skipped **only** with an explicit reason documented in the PR or handoff message.

### Valid Skip Reasons

- **"Not in scope"** — with a justification explaining why the area is unaffected.
- **"CI will cover"** — only when the exact test is already present in the CI pipeline.
- **"Blocked by [ticket-id]"** — when a dependency ticket must land first.

### Invalid Skip Reasons

- "Takes too long"
- "Should still work"
- "Didn't change that area"

### Reporting Skipped Validations

All skips must be listed in the handoff under a **"Skipped Validations"** heading with the format:

```text
## Skipped Validations
- `pnpm test:engine` — not in scope; no engine files changed.
- `pnpm build` — blocked by T-C01; shared type update lands there first.
```

## Regression Guards

When a PR touches specific areas, the corresponding regression suite **must** be re-run before handoff.

| Area Changed            | Required Command                                                      |
| ----------------------- | --------------------------------------------------------------------- |
| Auth or proxy code      | `pnpm --filter web test -- --run tests/unit/api-proxy-routes.test.ts` |
| Order or portfolio code | `pnpm --filter web test -- --run tests/pages/portfolio.test.tsx`      |
| Engine routes           | `pnpm test:engine`                                                    |
| Shared types            | `pnpm lint && pnpm test && pnpm test:engine`                          |
