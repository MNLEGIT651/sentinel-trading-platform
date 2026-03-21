# Deployment Follow-ups from the Current Repo Snapshot

This note separates issues that are directly supported by the current repository contents from ideas that would improve maintainability later but are not required to make the current snapshot work.

## Immediate correctness fixes

### 1. Engine Docker context mismatch

The engine Dockerfile is written for a monorepo-root build context: it copies `apps/engine/pyproject.toml` into `/app`, later copies `apps/engine/src` into `/app/src`, and starts `uvicorn` from that relocated `src.api.main:app` entrypoint. That means any deployment or build command must use the repository root as the Docker context (for example, `docker build -f apps/engine/Dockerfile .`), not `apps/engine` as the context directory. The current file contents make that requirement explicit, so this belongs in the correctness bucket rather than the optimization bucket.

### 2. Node workspace Docker installs depend on copying every referenced workspace manifest before `pnpm install`

Both Node Dockerfiles install dependencies from the monorepo root and now copy the root manifest plus `packages/shared/package.json`, `apps/web/package.json`, and `apps/agents/package.json` before running `pnpm install --frozen-lockfile`. That proves the current workspace graph is resolved during install time, not only after source files are copied. If any of those referenced workspace manifests are omitted from the dependency layer, the container build can fail before the application source is even copied. This is a present correctness requirement, not a future tuning idea.

## Optional medium-term optimizations

### 1. Build `packages/shared` to `dist/`

Current repo behavior: `@sentinel/shared` points both `main` and `types` at `./src/index.ts`, so the workspace is consumed directly from source today and does not require a compiled `dist/` output to function.

Building `packages/shared` to `dist/` could still be worthwhile later if you want stricter package boundaries, faster cold installs in some environments, or cleaner publishability, but the current snapshot does not show this as a broken path.

### 2. CI matrix refactor

Current repo behavior: `.github/workflows/ci.yml` uses three explicit jobs (`test-web`, `test-engine`, and `test-agents`) with duplicated setup steps for the two Node jobs, and that structure is valid as-is.

A matrix refactor could reduce duplication and centralize job setup, but it would be a maintainability improvement rather than a fix for a repo-proven failure.

### 3. Vercel ignore-command hardening

Current repo behavior: `vercel.json` only triggers Vercel builds when the diff touches `apps/web` or `packages/shared`, and the preview/production runbooks already describe skipped deploys under that rule as expected behavior.

Hardening the ignore command for edge cases such as unusual Git history shapes could make the deployment rule more robust, but the current snapshot documents the existing behavior as intentional rather than as a confirmed bug.

### 4. Python package rename/refactor

Current repo behavior: the engine package already installs under the distribution name `sentinel-engine`, while the runtime container launches `src.api.main:app` directly from the copied source tree.

Renaming or restructuring the Python package may improve consistency or packaging clarity later, but nothing in the current snapshot proves that the existing naming blocks builds or runtime startup.
