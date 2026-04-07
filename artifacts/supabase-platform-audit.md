Supabase boundary audit

- Config: `supabase/config.toml` uses schemas public/graphql_public, SSL enforcement enabled, seed enabled. No new migrations reviewed in this run.
- Client boundaries: `apps/web/src/lib/supabase/client.ts` and `server.ts` derive keys via `getSupabaseKey()` (publishable/anon only) and throw when missing, avoiding service-role keys on the client path. Server middleware allows pass-through when Supabase is unconfigured (offline/degraded mode).
- Workflow: `.github/workflows/supabase-typegen.yml` pins action SHA but uses `version: latest` for Supabase CLI and skips type generation entirely when secrets are absent, leaving drift undetected—a fail-open risk.
- Runtime probing: no live Supabase project access here; RLS and auth redirect flows not validated.

Warnings

- Supabase CLI version floats to `latest` in typegen workflow; lack of pinning + secret-based skip means type drift may go unnoticed.
- Typegen step is conditional on secrets and only warns when missing (no required gate).
- No runtime smoke of auth redirects/RLS in this execution.

Dashboard-only

- Cannot inspect production Supabase policies or connection state from this environment.
