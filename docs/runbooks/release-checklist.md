# Release Checklist

Use this checklist for every production release. Complete each section in order.

## 1. Local Validation

- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (web + agents)
- [ ] `pnpm build` passes (web build check)
- [ ] `pnpm test:web` passes
- [ ] `pnpm test:agents` passes
- [ ] `pnpm lint:engine` passes
- [ ] `pnpm format:check:engine` passes
- [ ] `pnpm test:engine` passes
- [ ] No untracked files that should be committed (`git status`)

## 2. Code Review Gate

- [ ] PR has been reviewed and approved
- [ ] CI pipeline passes all jobs (test-web, test-engine, test-agents)
- [ ] No `NEXT_PUBLIC_ENGINE_URL` or `NEXT_PUBLIC_AGENTS_URL` referenced in new client-side code
- [ ] No backend URLs or auth keys exposed to the browser
- [ ] No `localhost` URLs hardcoded in production code paths
- [ ] If API routes changed: proxy routes still forward correctly
- [ ] If env vars changed: deployment guide updated

## 3. Railway Backend Deploy

- [ ] Engine deployed to Railway
- [ ] Engine `/health` returns 200
- [ ] Engine logs show clean startup and correct port binding
- [ ] Agents deployed to Railway
- [ ] Agents `/health` returns 200
- [ ] Agents `/status` returns orchestrator state
- [ ] Agents logs show clean startup and correct port binding

## 4. Vercel Preview

- [ ] Vercel preview env vars set (`ENGINE_URL`, `ENGINE_API_KEY`, `AGENTS_URL`)
- [ ] Preview deployment reaches `READY` state
- [ ] `/api/engine/health` returns 200
- [ ] `/api/agents/health` returns 200
- [ ] `/api/settings/status` reports engine + agents connected
- [ ] `/settings` page shows all services connected
- [ ] `/agents` page loads with controls enabled
- [ ] `/` dashboard loads without offline banner
- [ ] Browser DevTools Network tab: no direct backend requests

## 5. Vercel Production

- [ ] Merge PR to `main`
- [ ] Vercel production deployment reaches `READY` state
- [ ] `/api/engine/health` returns 200
- [ ] `/api/agents/health` returns 200
- [ ] `/api/settings/status` reports engine + agents connected
- [ ] `/settings` page shows all services connected
- [ ] `/agents` page loads with controls enabled
- [ ] `/` dashboard loads without offline banner

## 6. Log Verification

- [ ] Vercel runtime logs: no `not_configured` errors
- [ ] Vercel runtime logs: no `localhost` in upstream URLs
- [ ] Vercel runtime logs: no auth header leakage
- [ ] Railway engine logs: clean startup
- [ ] Railway agents logs: clean startup

## 7. Post-Release Cleanup

Only after production is verified stable:

- [ ] Remove deprecated Vercel env vars (`NEXT_PUBLIC_ENGINE_URL`, `NEXT_PUBLIC_ENGINE_API_KEY`, `NEXT_PUBLIC_AGENTS_URL`)
- [ ] Decommission stale Railway services
- [ ] Verify removal doesn't break anything (redeploy and re-check)

## Rollback Trigger

If any production smoke test fails:

1. **Vercel:** Promote the previous `READY` deployment to production.
2. **Railway:** Redeploy the previous healthy deployment.
3. **Config:** Restore previous env values and redeploy.
4. **Investigate:** Only debug after traffic is restored to a working state.
