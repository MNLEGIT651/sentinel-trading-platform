# Claude Code Routines — Activation Runbook

This runbook is the **manual activation** checklist for every Claude Code
routine defined in this repository. The routine specs and the paired GitHub
Actions are already committed. What remains is the in-app wiring that only a
human with Claude account access can perform.

> Source of truth for the pairings: [`.claude/routines/manifest.yaml`](../../.claude/routines/manifest.yaml)
> Operator guide: [`docs/ops/routines.md`](../ops/routines.md)

## Prerequisites

Complete these once before activating any routine:

- [ ] You are signed in at `claude.ai/code/routines` on a seat that owns the
      Sentinel organization.
- [ ] The **Claude GitHub App** is installed on `stevenschling13/Trading-App`
      with read access to code, PRs, issues, and workflow runs, and write
      access to issues and PR comments.
- [ ] Required repo secrets are set in GitHub:
      - `GITHUB_TOKEN` (provided by GitHub — nothing to do).
      - `VERCEL_PREVIEW_SMOKE_URL` (optional; needed for
        `post-deploy-runtime-sentinel` probes).
- [ ] `pnpm routines:verify` passes locally on the default branch.
- [ ] You have re-read the routine spec under `.claude/routines/` before
      wiring each trigger.

## Activation environment reality check

This environment has **no credentials for the Claude Code app or web
routines surface**, and cannot programmatically create routines. That means:

- Specs, manifest, workflows, and verification are **created in-repo**.
- Native routines must be **activated manually** using the steps below.

Record each activation in `docs/ai/state/project-state.md` so other agents
know which routines are live.

---

## §1 — Morning Ops Commander

1. Open `claude.ai/code/routines` → **New routine**.
2. Name: `Morning Ops Commander — Sentinel`.
3. Trigger: **Schedule**, cron `30 13 * * *` (UTC).
4. Repository: `stevenschling13/Trading-App`.
5. Model: Claude Opus 4.7 (effort: high).
6. Connectors: GitHub (required); Vercel and Supabase connectors are optional
   and can be added later.
7. Paste the full prompt from `.claude/routines/morning-ops-commander.md`
   (section "Prompt Claude should run").
8. Save. Click **Run now** once to confirm:
   - The routine produces a report.
   - The ops report issue is created with labels `ops,report`.
9. Check the paired workflow in GitHub Actions
   (`.github/workflows/routine-morning-ops-commander.yml`) — it should run
   on the same schedule with a dry-run artifact.

---

## §2 — PR Intake Gatekeeper

1. Open `claude.ai/code/routines` → **New routine**.
2. Name: `PR Intake Gatekeeper — Sentinel`.
3. Trigger: **GitHub event** → `pull_request`: `opened`, `synchronize`,
   `reopened`, `ready_for_review`.
4. Repository: `stevenschling13/Trading-App`.
5. Model: Claude Opus 4.7 (effort: high).
6. Connectors: GitHub only.
7. Paste the prompt from `.claude/routines/pr-intake-gatekeeper.md`.
8. Confirm the Claude GitHub App is installed on this repo (otherwise GitHub
   event routines will not fire).
9. Save. Open a draft PR and then mark it ready-for-review to confirm:
   - A comment with marker `<!-- sentinel:pr-intake-gatekeeper -->` appears.
   - The paired `routine-pr-intake-gatekeeper.yml` workflow ran and uploaded
     the `pr-intake-payload-<pr>-<sha>` artifact.

---

## §3 — Post-Deploy Runtime Sentinel

1. Open `claude.ai/code/routines` → **New routine**.
2. Name: `Post-Deploy Runtime Sentinel — Sentinel`.
3. Trigger: **GitHub event** → `workflow_run` (workflows:
   `Vercel Preview Smoke`, `CI`, types: `completed`) **and**
   `deployment_status`.
4. Repository: `stevenschling13/Trading-App`.
5. Model: Claude Opus 4.7 (effort: high).
6. Connectors: GitHub; Vercel optional.
7. Paste the prompt from
   `.claude/routines/post-deploy-runtime-sentinel.md`.
8. Confirm `VERCEL_PREVIEW_SMOKE_URL` is configured on the repo if you want
   the bridge workflow to actually probe (otherwise the probe is skipped
   with a warning, which is fine for first activation).
9. Save. Trigger the bridge workflow via `workflow_dispatch` with a known
   preview URL to confirm the routine posts a verdict.

---

## §4 — Release Readiness Control Tower

1. Open `claude.ai/code/routines` → **New routine**.
2. Name: `Release Readiness Control Tower — Sentinel`.
3. Trigger: **API trigger**. Keep it webhook-disabled — invocation is
   operator-driven.
4. Repository: `stevenschling13/Trading-App`.
5. Model: Claude Opus 4.7 (effort: high; recommend enabling
   `/ultrareview` on run if the surface supports it).
6. Connectors: GitHub; Vercel and Supabase optional.
7. Paste the prompt from
   `.claude/routines/release-readiness-control-tower.md`.
8. Save.
9. Test by dispatching the paired workflow with
   `rollback_plan_confirmed=false` — confirm the workflow summary shows
   `NO-GO` and no deploy side effects occur.
10. Re-dispatch with `rollback_plan_confirmed=true` on a known-good SHA and
    confirm the preflight runs (`pnpm test:scripts`, `pnpm lint`,
    `pnpm typecheck`) and the routine posts its verdict.

---

## §5 — Weekly Architecture and Churn Audit

1. Open `claude.ai/code/routines` → **New routine**.
2. Name: `Weekly Architecture & Churn Audit — Sentinel`.
3. Trigger: **Schedule**, cron `0 14 * * 1` (UTC).
4. Repository: `stevenschling13/Trading-App`.
5. Model: Claude Opus 4.7 (effort: high).
6. Connectors: GitHub only.
7. Paste the prompt from
   `.claude/routines/weekly-architecture-churn-audit.md`.
8. Save. Click **Run now** once to confirm:
   - The paired workflow uploaded `weekly-arch-audit-<run_id>`.
   - The routine created an issue with title
     `[arch] Weekly Architecture & Churn Audit — YYYY-Www`.

---

## After every activation

Record the activation in `docs/ai/state/project-state.md` and in
`WORKLOG.md` (session log):

- routine id,
- date activated,
- trigger configuration,
- first successful run id.

## Deactivation

If a routine misbehaves:

1. Disable the routine at `claude.ai/code/routines` — the paired workflow
   continues to run and keeps collecting artifacts in-repo.
2. File an issue labeled `ops,routine,paused` referencing the cause.
3. Open a branch to adjust the routine spec and/or workflow. Run
   `pnpm routines:verify`.
4. Re-activate the routine after the fix lands on `main`.
