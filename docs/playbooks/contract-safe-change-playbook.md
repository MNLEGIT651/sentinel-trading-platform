# Contract-Safe Change Playbook

Use this playbook before proposing any change that touches shared contracts,
the proxy/auth boundary, engine request/response shapes, or database
migrations. These are Sentinel's highest-risk change surfaces.

See also: `docs/playbooks/repo-aware-ai-coding-playbook.md`,
`docs/ai/review-checklist.md`, `.claude/agents/contract-guardian.md`.

## When To Use

Trigger this playbook if a task touches **any** of these paths:

- `packages/shared/src/**`
- `apps/web/src/proxy.ts`
- `apps/web/src/lib/engine-fetch.ts`
- `apps/web/src/lib/engine-client.ts`
- `apps/engine/src/api/main.py`
- `apps/engine/src/api/routes/**`
- `apps/engine/src/config.py`
- `supabase/migrations/**`

If the task only touches one of these paths incidentally, still run the
consumer enumeration step — drift in these files affects every downstream
surface.

## Risk Matrix

| Surface                             | Blast radius                                   | Rollback difficulty                        |
| ----------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| `packages/shared/src/**`            | Web + agents + any TS consumer                 | Easy (revert + redeploy, watch type drift) |
| `apps/web/src/proxy.ts`             | Every web request; auth/session/CSRF posture  | Medium (revert + invalidate sessions)      |
| `apps/web/src/lib/engine-fetch.ts`  | Every web-to-engine call                       | Easy (revert)                              |
| `apps/web/src/lib/engine-client.ts` | Every server-side engine call (agents)         | Easy (revert)                              |
| `apps/engine/src/api/**`            | Every consumer of the endpoint                 | Medium (shape change breaks clients)       |
| `apps/engine/src/config.py`         | Engine auth, env contract                      | Medium (env rollout required)              |
| `supabase/migrations/**`            | Persistent database state                      | **Hard** — forward-only by convention      |

## Path Checklist

Before editing, confirm each:

1. **Consumer enumeration.** List every file and workspace that imports the
   contract you are changing. Use `grep -r` / `pnpm --filter ... typecheck`
   to verify.
2. **Issue linkage.** An open GitHub issue or "untracked audit" note exists
   for this change.
3. **Scope statement.** The task brief explicitly names the contract surface
   and the forbidden adjacent paths.
4. **Boundary preservation.** The change does not bypass `engine-fetch.ts`,
   does not add browser-facing backend URLs, does not move auth logic out of
   the proxy + route handler layering, and does not weaken CSRF or rate
   limiting.
5. **Test coverage per consumer.** Each consumer has a test that exercises
   the new shape (not only the file you edited).
6. **Migration reversibility.** If the change is a Supabase migration, either
   it is safely additive (nullable columns, new tables, new indexes) or the
   PR description documents the rollout plan and the manual backfill /
   rollback procedure.

## Validation Matrix

Pick the row(s) matching the paths you touched. Run at minimum every command
in those rows before opening a PR.

| Changed surface                        | Required commands                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/shared/src/**`               | `pnpm lint`, `pnpm test`, `pnpm --filter @sentinel/web build`, `pnpm test:engine` (if engine-facing) |
| `apps/web/src/proxy.ts`                | `pnpm lint`, `pnpm --filter web test -- --run tests/unit/service-proxy.test.ts tests/unit/api-proxy-routes.test.ts`, `pnpm test:web` |
| `apps/web/src/lib/engine-fetch.ts`     | `pnpm lint`, `pnpm test:web`, `pnpm --filter @sentinel/web build`                                    |
| `apps/web/src/lib/engine-client.ts`    | `pnpm lint`, `pnpm test:agents`                                                                      |
| `apps/engine/src/api/**`               | `pnpm lint:engine`, `pnpm format:check:engine`, `pnpm test:engine`, `pnpm test:web` (contract side) |
| `apps/engine/src/config.py`            | `pnpm lint:engine`, `pnpm format:check:engine`, `pnpm test:engine`                                   |
| `supabase/migrations/**`               | Manual review required. Run `supabase db lint` locally and document the plan in the PR.              |

Cross-cutting changes require the **union** of all applicable rows.

## Rollback Notes

- `packages/shared` — `git revert` is safe; watch for dependent PRs that
  have already been merged to avoid reintroducing the change.
- Proxy / auth — `git revert` + redeploy. If session cookies were rotated,
  users may need to re-authenticate.
- Engine shape changes — revert the engine commit; if web/agents already
  deployed against the new shape, you must also revert or patch those clients.
- Supabase migrations — forward-only. Prepare a compensating migration
  rather than reverting. Coordinate with the human owner before applying.

## Review Sign-Off

Before merge, confirm:

- `contract-guardian` subagent produced APPROVED or the PR description
  explicitly addresses every REVIEW NEEDED item.
- A human owner approved the PR (required for `supabase/migrations/**`,
  `packages/shared/src/**`, and any `.github/workflows/**` change).
- The PR description contains the validation table per
  `docs/ai/commands.md` → "Pass/Fail Reporting Format".
