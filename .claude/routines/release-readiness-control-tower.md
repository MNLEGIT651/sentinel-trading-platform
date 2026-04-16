# Routine: Release Readiness Control Tower

> Manifest id: `release-readiness-control-tower`
> Paired workflow: `.github/workflows/routine-release-readiness-control-tower.yml`
> Primary executor: Claude Code routine (API / manual trigger)
> Paired fallback: GitHub Action (`workflow_dispatch`)

## Objective

Produce a strict go/no-go verdict for a proposed release. Walk the full
release checklist, compare CI state, env contract, migrations, auth, proxy,
rate-limit, and rollback readiness. This is the most conservative routine
in the set — it must never auto-deploy.

## Why this belongs in Claude Code routines

- The task is on-demand, not scheduled, which fits the native **API trigger**.
- It needs judgment about evidence sufficiency, not rule execution.
- It is invoked at release time, so the repo-level `workflow_dispatch` pair
  gives humans a self-service way to ask the same question from the UI.

## Trigger contract

| Aspect | Value |
|---|---|
| Best primary trigger | **API trigger** (native routine) or **workflow_dispatch** |
| Paired GitHub Action | `.github/workflows/routine-release-readiness-control-tower.yml` |
| Paired workflow trigger | `workflow_dispatch` + optional `repository_dispatch` (`release-readiness`) |
| Repo attached | `stevenschling13/Trading-App` |
| Environment | `production` (selectable: `preview`) |
| Required connectors | GitHub (required), Vercel (optional), Supabase (optional) |
| Required secrets | `GITHUB_TOKEN` |

## Prompt Claude should run

```
You are the Release Readiness Control Tower for the Sentinel Trading Platform.
Repo: stevenschling13/Trading-App.

Inputs:
- release_tag (string, required)
- target_env (preview | production)
- rollback_plan_confirmed (boolean, required)

Read, in order:
1. docs/runbooks/release-checklist.md
2. docs/runbooks/production.md
3. docs/ai/review-checklist.md (Auth/Proxy Flows, Order/Trading Flows,
   Data Provenance Flows, Journal/Audit Flows)
4. .github/workflows/ci.yml (to understand required checks)
5. scripts/pr-guardian.mjs (for scope rules)

Produce this report:

## Release Readiness — <release_tag> (<target_env>)

### Evidence summary
| Check | Status | Evidence |
|---|---|---|
| CI green on release commit | ✅ / ❌ / ❓ | link |
| Preview smoke passing | ✅ / ❌ / ❓ | link |
| Env contract validated | ✅ / ❌ / ❓ | command output |
| No open high-risk PRs targeting same paths | ✅ / ❌ / ❓ | list |
| No pending supabase/migrations changes | ✅ / ❌ / ❓ | list |
| Auth / proxy invariants preserved | ✅ / ❌ / ❓ | notes |
| Rollback plan confirmed | ✅ / ❌ | input value |

### Risk analysis
- Migrations: [...]
- Shared contract drift: [...]
- Auth / proxy diffs: [...]
- Rate-limit / quota implications: [...]

### Missing evidence
- ...

### Verdict
- GO — all required evidence present; rollback plan confirmed.
- CONDITIONAL GO — list the conditions that must be met in the next N minutes.
- NO-GO — specific blockers; link to the ticket or command that unblocks.

### Rollback hook
Copy the relevant commands from docs/runbooks/production.md §Rollback.

Posting rules:
- Emit the verdict to the workflow summary.
- On NO-GO, create/refresh a GitHub issue with labels `release,readiness`.
- On GO, do NOT comment unless an issue already exists for this release_tag.

Constraints:
- Refuse to verdict GO if rollback_plan_confirmed is false.
- Do NOT tag, push, deploy, merge, or promote anything.
- Do NOT create release artifacts.
- Do NOT edit repo files.
```

## Success criteria

- Produces a verdict of `GO`, `CONDITIONAL GO`, or `NO-GO`.
- Always identifies missing evidence explicitly (empty list is acceptable).
- Always refers to `docs/runbooks/release-checklist.md` as the authoritative
  source.
- Never reports `GO` when `rollback_plan_confirmed` is false.

## Output format

See "Prompt Claude should run".

## Fail conditions

- Routine reports `GO` with `rollback_plan_confirmed=false`.
- Routine triggers deploys, tags, or merges.
- Routine edits repo files.

## Escalation rules

- `NO-GO`: create or refresh an issue `release,readiness` titled
  `[release] <release_tag> — NO-GO`.
- `CONDITIONAL GO`: post a comment on the existing release tracking issue or
  create one labeled `release,readiness,conditional`.
- Detected risk in migrations, shared contracts, or auth: include an
  explicit "stop-and-ask" flag in the report.

## What Claude may do automatically

- Read repo contents, PRs, CI runs, releases, deployments.
- Create/refresh a release readiness issue (labels `release,readiness`).
- Emit a workflow summary.

## What Claude must never do automatically

- Deploy, promote, rollback, or redeploy.
- Tag or push to `main` or any branch.
- Merge or close PRs.
- Modify any file in the repo.
- Approve or request changes on PRs.

## Mapping to the paired GitHub Action

The workflow `.github/workflows/routine-release-readiness-control-tower.yml`:

- Fires on `workflow_dispatch` and `repository_dispatch` (type
  `release-readiness`).
- Records the inputs (`release_tag`, `target_env`, `rollback_plan_confirmed`)
  as a JSON artifact for the routine.
- Runs a narrow preflight (`pnpm lint`, `pnpm typecheck`,
  `node --test scripts/check-env-contract.test.mjs`,
  `node --test scripts/validate-railway-supabase-env.test.mjs`) and attaches
  the log.
- Refuses the job and writes a `NO-GO` summary if
  `rollback_plan_confirmed=false`.

## Testing safely

1. Dispatch with `rollback_plan_confirmed=false` and confirm a `NO-GO`
   verdict is produced without any deploy side effects.
2. Dispatch with a known-good tag and `rollback_plan_confirmed=true` to
   verify the preflight runs and the routine posts a `GO`.

## Verifying a successful run

- Workflow run completed.
- Verdict present in the workflow summary.
- `NO-GO` verdict created/updated the tracking issue.
- No infra or repo state changes.

## Manual activation steps (Claude Code app)

See `docs/runbooks/claude-routines-activation.md` §4.
