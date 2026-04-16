# Claude Routines for Sentinel

These routines are repo-local, version-controlled automation playbooks for Claude Code.

## Why this shape

The repo already uses Claude Code through GitHub Actions. These routines keep the logic visible in git,
reviewable in PRs, and easy to invoke from scheduled or event-driven workflows.

Each routine:

- lives in `.claude/routines/*.md`
- is executed by a matching workflow in `.github/workflows/claude-routine-*.yml`
- keeps permissions narrow
- avoids code mutation unless a future routine explicitly requires it

## Installed routines

| Routine | Matching workflow | Purpose |
| --- | --- | --- |
| `morning-ops-commander.md` | `claude-routine-morning-ops.yml` | Daily repo + web-platform triage with one actionable ops report issue |
| `pr-web-risk-auditor.md` | `claude-routine-pr-web-risk-auditor.yml` | PR review focused on same-origin proxy, auth, provenance, and web regressions |
| `preview-runtime-sentinel.md` | `claude-routine-preview-runtime-sentinel.yml` | Failure-only preview smoke triage for Vercel/runtime regressions |
| `release-readiness-control-tower.md` | `claude-routine-release-readiness.yml` | Manual go/no-go audit before production release windows |

## Operating rule

Treat these files as source of truth for automated Claude behavior.
If a workflow should behave differently, update the routine file first, then the workflow.

## Safety model

Current routines are intentionally read-mostly:

- allowed: `gh` inspection, PR comments, issue creation/update, workflow-log inspection
- forbidden: deploys, merges, branch deletion, secret inspection, direct code edits

If a future routine needs write access to repository contents, add that as a separate task with an explicit risk review.
