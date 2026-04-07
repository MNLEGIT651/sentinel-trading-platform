# Production Platform Verification Checklist

_Last updated: 2026-04-07_

Use this checklist before releases and after infrastructure changes. It validates dashboard-level settings that are not fully provable from repository code alone.

## 1) GitHub: branch protections and required checks

- [ ] `main` is the default branch.
- [ ] Branch protection/ruleset for `main` requires pull requests.
- [ ] At least one approval is required before merge.
- [ ] Stale approvals are dismissed when new commits are pushed.
- [ ] Required status checks are enforced and up to date:
  - [ ] CI (`.github/workflows/ci.yml`)
  - [ ] Railway deploy (`.github/workflows/railway-deploy.yml`)
  - [ ] Dependency review (`.github/workflows/dependency-review.yml`)
  - [ ] Any additional mandatory security/release checks in your org
- [ ] Force pushes and branch deletion are blocked on `main`.
- [ ] GitHub environments gate production deploy jobs where applicable.

## 2) Vercel: environment variable scoping and runtime checks

- [ ] `apps/web` project root and `main` production branch are correct.
- [ ] Preview and Production env scopes are intentionally configured.
- [ ] Required production env vars are present:
  - [ ] `ENGINE_URL`
  - [ ] `ENGINE_API_KEY`
  - [ ] `AGENTS_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] Public Supabase key variable used by the app
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Deprecated browser-facing backend vars are not required by current production runtime.
- [ ] Production endpoint probes return expected status:
  - [ ] `/api/engine/health` (200)
  - [ ] `/api/agents/health` (200)
  - [ ] `/api/agents/status` (200)
  - [ ] `/api/settings/status` (200)

## 3) Railway: private networking and service URL correctness

- [ ] `engine` and `agents` services are mapped to the correct repo paths.
- [ ] Health checks are configured and passing.
- [ ] Restart policy is configured for each service.
- [ ] Service-to-service communication uses private/internal Railway networking where expected.
- [ ] Public service URLs (if used) match the URLs configured in Vercel server env vars.
- [ ] Deployment history shows a known good rollback target.
- [ ] Logs show no crash loops, port binding issues, or missing env errors.

## 4) Supabase: auth and RLS confirmation steps

- [ ] Site URL and redirect URLs match current Vercel production/preview domains.
- [ ] Auth providers are intentionally enabled; unused providers disabled.
- [ ] Session/JWT settings match security policy.
- [ ] RLS is enabled on all user-scoped tables.
- [ ] Service role keys are only used in server-side contexts.
- [ ] Backup/PITR posture is enabled according to environment policy.
- [ ] Recent migration history is applied and consistent with generated types.

## 5) Release sign-off record

Complete this block in release notes or ticket handoff:

```text
Date (UTC):
Verifier:
GitHub status:
Vercel status:
Railway status:
Supabase status:
Open risks:
Follow-up actions:
```
