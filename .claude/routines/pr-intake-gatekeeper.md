# Routine: PR Intake Gatekeeper

> Manifest id: `pr-intake-gatekeeper`
> Paired workflow: `.github/workflows/routine-pr-intake-gatekeeper.yml`
> Primary executor: Claude Code routine (GitHub event)
> Paired fallback: GitHub Action (pull_request)

## Objective

Give every incoming pull request a fast, consistent, narrative triage
comment that complements — never replaces — the mechanical checks run by
`scripts/pr-guardian.mjs` and `.github/workflows/pr-guardian.yml`.

## Why this belongs in Claude Code routines

- PRs arrive asynchronously; Anthropic-managed cloud sessions scale with
  event volume.
- Judgment (risk class, scope, split recommendation, validation evidence)
  is a natural Claude strength.
- The mechanical guardrails already exist; this routine adds reviewer-facing
  narrative without duplicating those checks.

## Trigger contract

| Aspect | Value |
|---|---|
| Best primary trigger | **GitHub event** — `pull_request`: `opened`, `synchronize`, `reopened`, `ready_for_review` |
| Paired GitHub Action | `.github/workflows/routine-pr-intake-gatekeeper.yml` |
| Paired workflow trigger | Same `pull_request` events |
| Repo attached | `stevenschling13/Trading-App` |
| Environment | none |
| Required connectors | GitHub |
| Required secrets | `GITHUB_TOKEN` |

GitHub-triggered routines require the **Claude GitHub App** to be installed
on `stevenschling13/Trading-App`.

## Prompt Claude should run

```
You are the PR Intake Gatekeeper for the Sentinel Trading Platform.
Repo: stevenschling13/Trading-App.

Context you receive from the triggering event:
- pull request number, title, author
- base ref, head ref, head SHA
- changed files list
- additions/deletions
- draft/ready state

Read these repo files before judging:
1. AGENTS.md (PR Quality Gates section)
2. docs/ai/working-agreement.md (Stop-And-Ask Changes, Branch Rules)
3. docs/ai/review-checklist.md
4. scripts/pr-guardian.mjs (for the authoritative thresholds)
5. docs/runbooks/release-checklist.md (for release-sensitive PRs)

Produce ONE structured review comment on the PR with this header:

<!-- sentinel:pr-intake-gatekeeper -->
## Claude PR Intake Gatekeeper

Sections:
- **Summary** — one-paragraph read of the PR's stated outcome and apparent scope.
- **Risk class** — `low | moderate | high` with a one-sentence reason.
- **Scope read** — file count, churn, workspace spread; flag "consider splitting"
  if heuristics suggest a multi-concern PR. Do NOT re-assert PR Guardian's
  hard thresholds; reference Guardian by name.
- **Sensitive paths touched** — list any hits against:
  - apps/web/src/lib/engine-fetch.ts
  - apps/web/src/lib/engine-client.ts
  - apps/web/src/middleware.ts
  - apps/engine/src/api/main.py
  - apps/engine/src/config.py
  - packages/shared/src/*
  - supabase/migrations/*
  - .github/workflows/*
- **Validation evidence** — does the PR body list commands run? If not,
  request that the author follow the format in docs/ai/commands.md.
- **Contract drift** — shared types, env contract, engine auth — flag if any.
- **Suggested next actions** — 1-3 bullets, actionable.

Constraints:
- Edit the comment in place if one with the same header marker exists.
- Skip draft PRs. Skip fork PRs if secrets are unavailable (annotate only).
- Do not assign labels unless the PR is clearly missing a type label — in
  that case, add `needs-triage`.
- Do not request reviewers.
- Do not approve, request changes, or request changes on behalf of reviewers.
- Do not merge. Do not close. Do not edit any file outside of the comment.
```

## Success criteria

- One comment with the `sentinel:pr-intake-gatekeeper` marker exists on the PR.
- The comment is edited on subsequent routine runs, never re-posted.
- No duplicate assertions of PR Guardian's hard-fail rules.
- No false approval/rejection on the PR.

## Output format

See the "Prompt Claude should run" section — the PR comment is the output.

## Fail conditions

- Comment fails to post or update.
- Routine cannot read the PR (permissions / app not installed).
- Routine attempts any non-permitted action.

## Escalation rules

- `high` risk PRs: add `needs-human-review` label and `@stevenschling13` mention
  inside the comment body (do not create a separate issue).
- PRs touching `.github/workflows/*` or `supabase/migrations/*` without an
  explicit scope note: mark risk as `high` and recommend "split PR".

## What Claude may do automatically

- Read PR metadata, files, diffs.
- Post or update the gatekeeper comment.
- Add the `needs-triage` label if the PR has no type label.
- Add `needs-human-review` for `high` risk PRs.

## What Claude must never do automatically

- Approve or request changes.
- Merge or close the PR.
- Edit any file in the repo (including PR body).
- Remove labels added by humans.
- Re-run PR Guardian or duplicate its hard-fail claims.
- Comment on unrelated PRs.

## Mapping to the paired GitHub Action

The workflow `.github/workflows/routine-pr-intake-gatekeeper.yml`:

- Listens to the same `pull_request` events.
- Skips drafts and fork PRs.
- Normalizes the PR payload into a compact JSON artifact
  (`pr-intake-payload-<pr>-<sha>.json`) so the routine always has stable
  inputs, even if the native GitHub event trigger payload shifts.
- Emits an annotated workflow summary (risk class, sensitive paths touched)
  as an always-on fallback view.

## Testing safely

1. Open a draft PR against `main`. Confirm the workflow skips it.
2. Mark it ready-for-review. Confirm the payload artifact appears.
3. Verify the native routine posts a gatekeeper comment.
4. Push another commit. Confirm the comment is *edited*, not re-posted.

## Verifying a successful run

- PR has exactly one comment starting with `<!-- sentinel:pr-intake-gatekeeper -->`.
- The paired workflow run shows success.
- No merge/close actions taken by the bot.
- PR Guardian's own comment is unchanged.

## Manual activation steps (Claude Code app)

See `docs/runbooks/claude-routines-activation.md` §2.
