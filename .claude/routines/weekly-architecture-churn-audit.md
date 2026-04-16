# Routine: Weekly Architecture and Churn Audit

> Manifest id: `weekly-architecture-churn-audit`
> Paired workflow: `.github/workflows/routine-weekly-architecture-churn-audit.yml`
> Primary executor: Claude Code routine (schedule)
> Paired fallback: GitHub Action (schedule)

## Objective

Every Monday, produce a maintainability snapshot of the Sentinel Trading
Platform — churn hotspots, oversized files, weakly tested / flaky areas,
architecture drift against `docs/ai/architecture.md`, and operational toil
candidates.

## Why this belongs in Claude Code routines

- The audit is long-running and repetitive, a natural Anthropic-managed
  cloud session.
- It combines quantitative signals (churn, sizes) with judgment
  (architecture drift, duplication) — Claude is strong at the second half.
- It complements, but does not replace, `sentinel-ops-commander`'s "weekly
  audit" section.

## Trigger contract

| Aspect | Value |
|---|---|
| Best primary trigger | **Schedule** — `cron: "0 14 * * 1"` (Monday 14:00 UTC / 09:00 US Central) |
| Paired GitHub Action | `.github/workflows/routine-weekly-architecture-churn-audit.yml` |
| Paired workflow trigger | `schedule: "0 14 * * 1"` + `workflow_dispatch` |
| Repo attached | `stevenschling13/Trading-App` |
| Environment | none |
| Required connectors | GitHub |
| Required secrets | `GITHUB_TOKEN` |

## Prompt Claude should run

```
You are the Weekly Architecture and Churn Auditor for the Sentinel Trading
Platform. Repo: stevenschling13/Trading-App.

Read:
1. docs/ai/architecture.md
2. AGENTS.md (Sensitive Paths section)
3. scripts/pr-guardian.mjs (for the authoritative size/health thresholds)
4. .claude/skills/sentinel-ops-commander/SKILL.md (weekly audit section)

Consume the artifacts uploaded by the paired workflow:
- churn-last-week.txt — file-level churn, last 7 days
- file-sizes.txt — top 30 files by line count in source directories
- large-file-growth.txt — files that grew > 50 lines during the window
- recent-pr-history.json — last 30 PRs with labels and review status
- ci-flakiness.json — last 20 CI runs

Produce this report:

## [arch] Weekly Architecture & Churn Audit — <YYYY-Www>

### 1. Churn hotspots
<files edited more than 5x in the last 7 days, with owner guess and risk class>

### 2. Oversized files
<files above 400 lines, and any that grew >50 lines in the window>

### 3. Architecture drift
<claims that deviate from docs/ai/architecture.md or AGENTS.md>

### 4. Weak / flaky tests
<last CI runs with intermittent failures; pattern matches>

### 5. Duplication / toil candidates
<heuristic candidates: repeated logic, unclear ownership, obvious helpers>

### 6. Maintainability trend
<one paragraph: getting healthier / stable / slipping, with one reason>

### Recommended follow-ups
- (ticket-style bullets, each scoped small enough for a single agent)

Posting rules:
- Create or refresh an issue titled `[arch] Weekly Architecture & Churn Audit
  — <YYYY-Www>` with labels `ops,report,architecture`.
- Do NOT open PRs or refactor anything.
- Do NOT file separate issues for each finding; bundle them in the weekly
  report unless a finding is explicitly FAIL-severity.
```

## Success criteria

- Report covers all 6 sections.
- Report issue exists (or is edited) for the current ISO week.
- No duplicate report issues for the same ISO week.
- Recommendations reference existing repo docs or concrete files.

## Output format

See "Prompt Claude should run".

## Fail conditions

- Routine fails to read artifacts (workflow must succeed first).
- Routine opens PRs or refactors code automatically.

## Escalation rules

- Architecture drift claims touching sensitive paths (see `AGENTS.md`
  Sensitive Paths): mark the finding with `stop-and-ask` and mention
  `@stevenschling13` in the bullet.
- Churn on `.github/workflows/*` or `packages/shared/src/*`: explicitly
  note that PR Guardian thresholds may need review.

## What Claude may do automatically

- Read artifacts, repo files, PR/issue history.
- Create/refresh the weekly report issue (labels `ops,report,architecture`).
- Edit the existing same-week issue instead of creating a duplicate.

## What Claude must never do automatically

- Open PRs or branches.
- Edit repo code.
- Apply labels outside of its own report issue.
- Close older weekly reports (keep the history).

## Mapping to the paired GitHub Action

The workflow `.github/workflows/routine-weekly-architecture-churn-audit.yml`:

- Runs on Monday at 14:00 UTC and on `workflow_dispatch`.
- Computes churn metrics via `git log`, file sizes via `wc -l`, and
  PR history / CI flakiness via `gh` CLI.
- Uploads all artifacts under one archive named
  `weekly-arch-audit-<run_id>`.
- Emits a compact workflow summary (top 10 churn files, counts) so the audit
  status is visible in-repo even when the native routine is off.

## Testing safely

1. Trigger the workflow via `workflow_dispatch` with the default window.
2. Inspect the artifact bundle.
3. Let the native routine consume it and verify the issue is created with
   the expected ISO week number in the title.
4. Re-trigger the workflow in the same week and confirm the routine edits
   the existing issue rather than opening a new one.

## Verifying a successful run

- Workflow run completed, artifacts attached.
- An issue with title prefix `[arch] Weekly Architecture & Churn Audit —`
  and ISO week suffix exists for the current week.
- No code changes in the repo by the routine.

## Manual activation steps (Claude Code app)

See `docs/runbooks/claude-routines-activation.md` §5.
