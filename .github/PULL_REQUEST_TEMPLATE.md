## Summary

Describe the outcome in 2-5 lines.

## Agent Metadata

<!-- Required for AI-generated PRs. Human PRs may leave agent as "Human". -->

| Field              | Value                                          |
| ------------------ | ---------------------------------------------- |
| **Agent**          | <!-- Claude Code / Codex / Copilot / Human --> |
| **Claimed ticket** | <!-- e.g., SENT-42 or "untracked audit" -->    |

## Scope

- Files or modules intentionally changed:
- Files or modules intentionally untouched:
- Workspace areas touched: <!-- e.g., apps/web only -->
- Estimated file count: <!-- aim for <20 files per PR -->

## Validation

- [ ] Branch created from current `main` HEAD
- [ ] `git diff --check`
- [ ] Relevant commands from `docs/ai/commands.md` were run
- [ ] Exact command results are listed below

### Command Results

- `command`: pass/fail

## Quality Checks

- [ ] No file exceeds 400 lines (or decomposition plan included)
- [ ] All imports resolve — no hallucinated modules/types
- [ ] Single concern — PR does not mix unrelated changes
- [ ] No accidental shared contract drift
- [ ] No accidental migration or env contract change
- [ ] Changed architectural boundary declared (proxy/auth/shared contracts/migrations)
- [ ] Contract consumers checked (if packages/shared, proxy, or migrations touched)
- [ ] No secrets or credentials in the diff

## Reviewer Focus

Call out the riskiest part of the change and where to review it.
