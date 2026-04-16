# Routine: Morning Ops Commander

> Manifest id: `morning-ops-commander`
> Paired workflow: `.github/workflows/routine-morning-ops-commander.yml`
> Primary executor: Claude Code routine (schedule)
> Paired fallback: GitHub Action (schedule)

## Objective

Produce a daily operations report for the Sentinel Trading Platform. The
report triages repository, CI, deployment, and issue health so the human
owner can start the day with a single, consistent summary — not a scattered
collection of alerts.

## Why this belongs in Claude Code routines

- The task is repetitive, long-running, and benefits from judgment
  (rating, deduping, grouping).
- It runs on a schedule, so an Anthropic-managed cloud session is a natural
  fit.
- It complements rather than replaces the existing
  [`sentinel-ops-commander`](../skills/sentinel-ops-commander/SKILL.md) skill,
  which is an interactive on-demand skill for the same checks.

## Trigger contract

| Aspect | Value |
|---|---|
| Best primary trigger | **Schedule** — `cron: "30 13 * * *"` (13:30 UTC daily / 08:30 US Central) |
| Paired GitHub Action | `.github/workflows/routine-morning-ops-commander.yml` |
| Paired workflow trigger | `schedule: "30 13 * * *"` + `workflow_dispatch` |
| Repo attached | `stevenschling13/Trading-App` |
| Environment | none |
| Required connectors | GitHub (required), Vercel (optional), Supabase (optional) |
| Required secrets | `GITHUB_TOKEN` (provided by the Claude GitHub App and/or workflow) |

## Prompt Claude should run

```
You are the Morning Ops Commander for the Sentinel Trading Platform.
Repo: stevenschling13/Trading-App.

Read, in order:
1. AGENTS.md
2. docs/ai/working-agreement.md
3. docs/ai/architecture.md
4. .claude/skills/sentinel-ops-commander/SKILL.md
5. docs/runbooks/production.md

Then run the ops check protocol from the sentinel-ops-commander skill
against THIS repo (not the legacy MNLEGIT651 repo mentioned in the skill).
Adapt repo/branch references to stevenschling13/Trading-App and main.

Produce a report in this exact format (markdown):

## Sentinel Ops Report — <YYYY-MM-DD>

| Check                | Rating | Notes |
|----------------------|--------|-------|
| CI Health            | PASS / WARN / FAIL | ... |
| Open PRs             | PASS / WARN / FAIL | ... |
| Issues Triage        | PASS / WARN / FAIL | ... |
| Security Advisories  | PASS / WARN / FAIL | ... |
| Deployment Health    | PASS / WARN / FAIL | ... |
| Branch Hygiene       | PASS / WARN / FAIL | ... |
| Dependency Freshness | PASS / WARN / FAIL | ... |

### Actions Taken
- ...

### Items Requiring Human Attention
- ...

Post the report as a GitHub issue with:
  title: "[ops] Morning Ops Report — <YYYY-MM-DD>"
  labels: ops, report
Only file FAIL-rated alerts as separate issues. Deduplicate against any
existing issue with the same title.

Do NOT:
- merge PRs
- close PRs
- delete branches
- change secrets or env vars
- deploy
- edit code (other than creating/updating report issues)
```

## Success criteria

- All 7 rated checks appear in the report.
- The report issue is created (or updated, if one already exists for today).
- No duplicate report issue exists for the same UTC date.
- Any FAIL finding either has a corresponding tracking issue or is explicitly
  flagged as "human attention required" in the report.

## Output format

See the "Prompt Claude should run" section above — the report *is* the output.

## Fail conditions

Mark the run as failed if:

- The routine cannot access the repo (permissions / app not installed).
- The routine fails to produce the required 7 ratings.
- The routine tries to perform any action outside the "Do NOT" list.

## Escalation rules

- `FAIL` on CI Health or Deployment Health: file a `ops,fail` issue, tag the
  human owner `@stevenschling13`.
- `FAIL` on Security Advisories (`high`/`critical`): file a `ops,security` issue
  within the same run.
- `WARN` findings: include in the report only; no separate issues.

## What Claude may do automatically

- Read the repository.
- List/inspect issues, PRs, workflow runs, deployments, dependabot alerts.
- Create a new report issue (labels `ops,report`).
- Create FAIL-severity tracking issues (labels `ops,<severity>`).
- Edit an existing report issue for the same UTC date instead of creating a duplicate.

## What Claude must never do automatically

- Merge, close, or comment on unrelated PRs.
- Delete branches.
- Modify any file in the repo (including `.github/workflows/*`).
- Deploy to Vercel or Railway.
- Run or modify Supabase migrations.
- Touch secrets or environment variables.

## Mapping to the paired GitHub Action

The workflow `.github/workflows/routine-morning-ops-commander.yml`:

- Runs on the same cron (`30 13 * * *`) plus `workflow_dispatch`.
- Collects raw signals (CI status, open PRs, stale branches, dependency
  alerts) using `gh` CLI.
- Uploads the collected payload as an artifact (`morning-ops-report-<run_id>`).
- Emits a structured workflow summary so the routine status is visible in-repo
  even when the native routine is disabled.

## Testing safely

1. Run the paired workflow via `workflow_dispatch` and inspect the artifact.
2. Trigger the native routine from the Claude Code app via **Run now** on a
   non-production day.
3. Verify the created issue is deduped by title.

## Verifying a successful run

- An issue titled `[ops] Morning Ops Report — <YYYY-MM-DD>` exists for the run day.
- The issue carries labels `ops, report`.
- The paired workflow run shows success and the `morning-ops-report-<run_id>`
  artifact is present.
- No duplicate ops report issue exists for the same UTC date.

## Manual activation steps (Claude Code app)

See `docs/runbooks/claude-routines-activation.md` §1.
