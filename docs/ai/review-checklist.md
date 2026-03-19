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
