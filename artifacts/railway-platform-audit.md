Railway deploy audit (apps/engine, apps/agents)

- Config: `apps/engine/railway.toml` and root `railway.toml` (agents) define dockerfile paths and `/health` checks, restart on failure, single replica. Agents build expects root context with shared packages.
- Workflow: `.github/workflows/railway-deploy.yml` installs Railway CLI via `npm install -g @railway/cli` (unpinned) and skips health checks entirely when `RAILWAY_ENGINE_URL` / `RAILWAY_AGENTS_URL` secrets are unset—fail-open behavior. Deploy uses `railway up --detach` without version pinning or rollback plan.
- Observability: no proxy verification of web endpoints after deploy; only service-local `/health` checks (and those can be skipped). No smoke of `/api/engine/health` or `/api/agents/health`.
- Live probing: not possible from this environment.

Blockers

- Health checks fail open when URL secrets are missing in workflow; deploy can pass with zero validation.

Warnings

- Railway CLI installed unpinned from npm registry; reproducibility and supply-chain risk.
- No post-deploy proxy/edge smoke (web origin to engine/agents) or rollback automation in workflow.

Dashboard-only

- Live Railway service status not probed here; requires dashboard verification.
