GitHub platform audit (repo: stevenschling13/Trading-App, branch: main)

- Workflow hygiene: actions pinned to commit SHAs in `.github/workflows/ci.yml` (checkout, setup-node/python, cache). Release-management/railway/supabase-typegen use the same pattern.
- Failing checks observed on all open PRs: `CircleCI Pipeline` reports “No configuration was found…” for heads 6d575505, 9457f397, 521d7f62, f7ba364d, 723a9918, fc32f6b5, 9cc035a9, 04c53626. CircleCI is not configured in-repo, so this status is an external/stale check; unclear whether it is required (dashboard-only blocker).
- Required checks/rulesets: branch protection and required-check definitions not visible from repo; treat as dashboard-only until confirmed.
- Workflow gaps: no in-repo Vercel preview smoke workflow present (actions list shows one but file absent), so preview health verification cannot be validated here.
- Permissions/secrets: workflows rely on repository secrets (Railway, Supabase) but no leakage found; permissions blocks set to `contents: read` in CI, but Supabase typegen writes on push (requires audit in Supabase track).

Blockers

- Dashboard-only: Unknown branch protection / required checks; CircleCI status errors with no in-repo config may block merges if required.

Warnings

- Missing verified Vercel preview smoke workflow file despite dashboard entry; cannot confirm preview health gates.
