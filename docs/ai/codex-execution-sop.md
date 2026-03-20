# Codex Execution SOP

> Read `AGENTS.md` first, then the docs in `docs/ai/`. This file is intentionally thin and only
> captures Codex-specific guidance. The canonical repo rules remain in the shared AI docs.

## Codex Role

- Use Codex for bounded implementation, targeted test additions, and mechanical edits.
- If the task becomes ambiguous, cross-cutting, or architecture-heavy, hand it back for
  decomposition instead of widening scope.

## Source Of Truth

- Task contract, branch/worktree rules, and stop-and-ask boundaries live in
  `docs/ai/working-agreement.md`.
- Validation commands live in `docs/ai/commands.md`.
- Review expectations live in `docs/ai/review-checklist.md`.

## Codex-Specific Notes

- Prefer the smallest diff that satisfies the requested outcome.
- Keep local agent or MCP configuration out of version control. Files such as `.mcp.json` should
  stay local unless the task explicitly scopes a repo-wide shared config.
- When handing work back, report the exact commands run, their pass/fail status, and any remaining
  assumptions or risks.
