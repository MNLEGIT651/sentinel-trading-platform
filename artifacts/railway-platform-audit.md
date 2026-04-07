# Railway Platform Audit

- Status: **FAIL**

## Blocking Findings

- Railway deploy workflow uses floating global CLI install (`npm install -g @railway/cli`) rather than pinned version.

## Warnings

- Health checks are conditionally skipped if RAILWAY_ENGINE_URL or RAILWAY_AGENTS_URL secrets are absent, reducing fail-closed certainty.

## Dashboard-only blockers

- No Railway dashboard/API deploy history was available in this run; production service mapping must be confirmed in Railway dashboard.
