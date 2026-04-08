---
name: sentinel-github
description: This skill should be used for GitHub and CI/CD operations on the Sentinel trading platform — including "CI failing", "GitHub Actions", "fix the CI", "branch naming", "PR workflow", "why is the check failing", "add a GitHub secret", "debug the pipeline", "test-web failed", "test-engine failed", "branch strategy", "merge to main", or any time the GitHub repo or CI pipeline is being worked with. Also apply when setting up GitHub for a new clone.
---

# Sentinel GitHub Operations

**Repository:** [github.com/stevenschling13/sentinel-trading-platform](https://github.com/stevenschling13/sentinel-trading-platform) (private)
**Default branch:** `main`
**CI:** GitHub Actions — `.github/workflows/ci.yml`
**Vercel integration:** Connected — auto-deploys web on push to `main`

---

## Branch Strategy

Use short-lived feature branches off `main`. Name them by type and app scope:

```
feature/web/<description>      # Next.js dashboard changes
feature/engine/<description>   # Python engine changes
feature/agents/<description>   # Agent orchestration changes
feature/shared/<description>   # Shared types package
fix/web/<description>          # Bug fixes
fix/engine/<description>
chore/<description>            # Deps, config, tooling
```

**Keep `main` deployable at all times.** All CI checks must pass before merging.

---

## CI Pipeline

Five jobs defined in `.github/workflows/ci.yml`. All run on `ubuntu-latest`. Concurrency group cancels in-progress runs on force-push to the same branch — this prevents wasteful duplicate CI runs.

`verify-commit-signatures` and `security-audit` only run on pushes to `main` and PRs targeting `main` or `release/*`. The three test jobs run on every push and PR.

### Job 0: `verify-commit-signatures` (main/release PRs only)

Verifies all commits in the push range are either GPG-good or GitHub-verified. Reads trusted signers from `.github/trusted_signers` and exceptions from `docs/security/commit-signing-exceptions.txt`.

### Job 1: `test-web` (Node 22 + pnpm)

1. Installs deps with `pnpm install --frozen-lockfile`
2. Runs `pnpm lint` (ESLint + TSC across all packages)
3. Runs `pnpm --filter web test` (Vitest)
4. Runs `pnpm --filter web build` with **placeholder** Supabase env vars

The build step uses:

```yaml
NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: placeholder-publishable-key
SUPABASE_SERVICE_ROLE_KEY: placeholder-service-role-key
NEXT_TELEMETRY_DISABLED: '1'
```

**No real secrets needed in CI for the web build.** The build just needs the vars to be present and non-empty.

### Job 2: `test-engine` (Python 3.12 + uv)

1. Installs uv, creates venv, installs `.[dev]` in `apps/engine/`
2. Runs `ruff check` and `ruff format --check`
3. Runs `.venv/bin/python -m pytest tests --tb=short`
4. Uses `PYTHONDONTWRITEBYTECODE=1` to skip `.pyc` generation

Note: Linux path (`.venv/bin/python`, not `.venv/Scripts/python`). Local Windows dev uses `Scripts/`.

### Job 3: `test-agents` (Node 22 + pnpm)

1. Installs deps
2. Runs `pnpm --filter agents build` (TypeScript type-check)
3. Runs `pnpm --filter agents test` (Vitest)

### Job 4: `security-audit` (main/release PRs only)

Runs after all three test jobs. Installs `pip-audit` and runs `node scripts/security-audit.mjs`.

---

## Debugging CI Failures

**Find the failing job:**

```bash
gh run list --repo stevenschling13/sentinel-trading-platform --limit 5
gh run view <run-id> --log-failed
```

**Common failure patterns:**

| Job                | Failure                   | Cause                           | Fix                                                                |
| ------------------ | ------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `test-web` — tests | Vitest assertion failure  | Test expects old behaviour      | Update test or fix code                                            |
| `test-web` — build | TypeScript error          | Type mismatch after changes     | Fix types, run `pnpm --filter web build` locally first             |
| `test-web` — build | `frozen-lockfile` failure | `pnpm-lock.yaml` not updated    | Run `pnpm install` locally and commit the lock file                |
| `test-engine`      | pytest failure            | Test assertion or import error  | Run `.venv/Scripts/python -m pytest tests -x` locally              |
| `test-engine`      | `ModuleNotFoundError`     | New dep not in `pyproject.toml` | Add dep, run `uv pip install -e ".[dev]"`, commit `pyproject.toml` |
| `test-agents`      | Vitest failure            | TypeScript compile error        | Run `pnpm --filter agents lint` locally                            |

**Always reproduce locally before pushing a fix.** Pushing blind fix attempts adds noise to the CI history.

---

## GitHub Secrets

Currently **no secrets are required** for CI — the web build uses placeholder vars and the engine tests don't hit external services.

If you add tests that need real credentials (integration tests against live Supabase, Polygon, etc.), add them as GitHub repository secrets:

```bash
gh secret set SUPABASE_SERVICE_ROLE_KEY --repo stevenschling13/sentinel-trading-platform
gh secret set POLYGON_API_KEY --repo stevenschling13/sentinel-trading-platform
```

Then reference them in `ci.yml`:

```yaml
env:
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

## Commit Message Convention

Follow the pattern from existing commits:

```
<type>(<scope>): <description>

feat(web): add portfolio heat map dashboard
fix(engine): handle Polygon 429 rate limit gracefully
fix(agents): standardize error response shape
chore: update pnpm lockfile
refactor(engine): extract risk calculations to own module
test(engine): add hypothesis tests for RSI bounds
docs: update CLAUDE.md with engine startup command
```

Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `perf`, `ci`
Scopes: `web`, `engine`, `agents`, `shared`, `deploy`, `ci`

---

## PR Workflow

1. Create branch: `git checkout -b feature/web/my-feature`
2. Make changes and commit with conventional commit messages
3. Push: `git push -u origin feature/web/my-feature`
4. Open PR: `gh pr create --title "feat(web): ..." --body "..."`
5. CI runs automatically — wait for all 3 jobs green
6. Vercel creates a preview deployment — check the preview URL
7. Merge: `gh pr merge --squash` (squash keeps `main` history clean)

**Before merging, verify:**

- [ ] All CI checks pass (test-web, test-engine, test-agents)
- [ ] Vercel preview deployment is `READY` (not ERROR)
- [ ] Preview URL renders correctly
- [ ] If API changed: all 6 layers updated (see `sentinel-api-sync`)
- [ ] If schema changed: migration applied, TS types regenerated
- [ ] No `.env` files accidentally committed

---

## Vercel + GitHub Integration

The `sentinel-trading-platform-agents` Vercel project is connected to this GitHub repo. Pushes to `main` trigger Vercel deployments. PRs get preview deployments automatically.

Vercel skips deployments when `apps/web` and `packages/shared` are unchanged (the `ignoreCommand` in `vercel.json`). See `sentinel-vercel-ops` for details.

---

## Additional Resources

- **`references/ci-troubleshooting.md`** — Detailed debugging guide for each CI job failure pattern
- `gh run list` and `gh run view` — CLI tools for CI monitoring (GitHub CLI must be authenticated)
- Use `commit-commands:commit` skill for commit creation
- Use `pr-review-toolkit:review-pr` for PR review
