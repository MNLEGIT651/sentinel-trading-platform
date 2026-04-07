Vercel runtime audit (apps/web)

- Config: `apps/web/vercel.json` uses turbo build, inline `ignoreCommand` `git diff --quiet HEAD^ HEAD -- apps/web/ packages/shared/` (not merge-base aware; may skip builds on merge commits). Functions maxDuration 60s; cron hits `/api/health` every 5 minutes.
- Health coverage: `/api/health` returns engine/agents dependency status (200 with degraded flag) but no distinct `/api/engine/health` or `/api/agents/health` routes. No automated preview smoke workflow present in repo.
- Build result: `pnpm build` failed locally because `next/font/google` in `apps/web/src/app/layout.tsx` tried to fetch DM Sans and JetBrains Mono from fonts.googleapis.com (blocked). This is a repo-side, release-blocking build failure until fonts are self-hosted or removed.
- Runtime probing: no live Vercel preview available from this environment; verification blocked.

Blockers

- Web build fails offline due to `next/font/google` external fetch in `apps/web/src/app/layout.tsx` (DM Sans, JetBrains Mono).

Warnings

- `ignoreCommand` uses `HEAD^` comparison instead of merge-base; can skip builds on merge commits or rebases.
- No in-repo Vercel preview smoke/health workflow; runtime verification relies on dashboard only.
