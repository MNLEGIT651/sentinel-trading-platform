# Review Checklist

Use this checklist before opening or merging PRs created by Claude Code, Codex, or humans.

## Scope

- Is the change focused on a single task?
- Are unrelated edits avoided?
- Does the title/body explain the user-visible outcome?

## Cross-app integrity

- If an engine route changed, were web and agent callers reviewed?
- If shared types changed, were runtime contracts verified?
- If a migration changed, were affected callers and assumptions reviewed?

## Safety and security

- Were secrets kept out of source control?
- Were client-side secret flows avoided?
- Were approval, execution, and risk-sensitive paths treated carefully?

## Tests and checks

- Were the smallest relevant tests run?
- If checks were skipped, is the reason documented?
- For UI-affecting changes, was a runtime smoke test performed?

## Maintainability

- Does the code follow existing patterns?
- Are new abstractions justified?
- Were docs updated when workflow or architecture changed?

## Merge readiness

- CI passes or blockers are understood.
- Review comments are addressed.
- The PR is small enough for a human reviewer to reason about safely.
