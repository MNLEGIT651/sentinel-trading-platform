# Commands for Local Validation

Use the smallest relevant command set for the files you change.

## Monorepo

- `pnpm dev` — run all app dev servers through Turborepo.
- `pnpm build` — build all configured workspaces.
- `pnpm test` — run all workspace tests.
- `pnpm lint` — run workspace lint tasks.

## Web (`apps/web`)

- `pnpm --filter @sentinel/web dev --hostname 127.0.0.1 --port 3000`
- `pnpm --filter @sentinel/web test`
- `pnpm --filter @sentinel/web lint`
- `pnpm --filter @sentinel/web build`

## Agents (`apps/agents`)

- `pnpm --filter @sentinel/agents start`
- `pnpm --filter @sentinel/agents test`
- `pnpm --filter @sentinel/agents lint`

## Engine (`apps/engine`)

- `python3 -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000`
- `python3 -m pytest apps/engine/tests/unit`
- `python3 -m pytest apps/engine/tests/integration`

## Focused smoke checks

### Web

- `curl -I http://127.0.0.1:3000/`
- `curl http://127.0.0.1:3000/api/health`
- `curl http://127.0.0.1:3000/api/settings/status`

### Engine

- `curl http://127.0.0.1:8000/health`
- `curl http://127.0.0.1:8000/api/v1/strategies/`
- `curl http://127.0.0.1:8000/api/v1/risk/limits`

### Agents

- `curl http://127.0.0.1:3001/health`
- `curl http://127.0.0.1:3001/status`
- `curl -X POST http://127.0.0.1:3001/cycle`

## Environment notes

- Engine startup requires Supabase env vars.
- Market-data features require `POLYGON_API_KEY`.
- Agent runtime requires engine + Supabase + Anthropic-related env vars to be meaningful.
- If a check is blocked by missing env or third-party connectivity, document that explicitly in the final report.
