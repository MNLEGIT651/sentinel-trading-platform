# Github Platform Audit

- Status: **FAIL**

## Blocking Findings

- Railway deploy workflow installs @railway/cli without version pinning, creating non-deterministic deploy behavior.

## Warnings

- None

## Dashboard-only blockers

- Branch protection/ruleset visibility unavailable via API (status 401). Verify required checks in GitHub dashboard.
- Cannot confirm branch protection required-check enforcement from repository-local evidence alone.
