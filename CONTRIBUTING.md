# Contributing to Sentinel Trading Platform

Thank you for your interest in contributing! Whether you're fixing a bug, adding a feature, or improving documentation, your help is appreciated.

## Development Setup

### Prerequisites

- **Node.js** 22+ with **pnpm** 10.32+
- **Python** 3.12+ with **uv**
- A populated `.env` file (copy from `.env.example`)

### Install

```bash
# Install Node dependencies
pnpm install

# Set up the Python engine virtual environment
cd apps/engine
uv sync
cd ../..
```

## Code Style

### TypeScript / JavaScript

Prettier is the single formatter. Key settings: semicolons enabled, single quotes, trailing commas (all). ESLint enforces lint rules across all Node workspaces.

### Python

Ruff handles both linting and formatting for the engine (`apps/engine`).

### Enforcement

Husky pre-commit hooks run formatters and linters automatically. You can also run them manually:

```bash
pnpm lint                 # Node workspaces
pnpm lint:engine          # Ruff lint (Python)
pnpm format:check:engine  # Ruff format check (Python)
```

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced via **commitlint**.

Allowed types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `ci`, `perf`, `revert`

```
feat(web): add portfolio allocation chart
fix(engine): handle empty ticker list in screener
chore: bump dependencies
```

## Branch Naming

Use a prefix that matches the commit type:

- `feat/` — new features
- `fix/` — bug fixes
- `chore/` — maintenance, dependencies, config
- `docs/` — documentation changes

Example: `feat/portfolio-chart`, `fix/screener-empty-list`

> **Note for AI agents:** Do not create branches with `copilot/`, `claude/`, or `worktree-` prefixes.
> These patterns are excluded from Vercel preview deployments and will not receive automated builds.
> Use the standard prefixes above instead.

## Pull Request Process

1. Create a branch from `main` using the naming convention above.
2. Make your changes with clear, focused commits.
3. Fill out the **PR template** when opening your pull request.
4. Ensure all CI checks pass before requesting review.
5. Request review from the relevant [CODEOWNERS](.github/CODEOWNERS).
6. Address review feedback promptly; prefer fixup commits during review.

## Testing Requirements

All tests must pass before merge:

```bash
pnpm test          # Node workspace tests (web + agents)
pnpm test:engine   # Python engine tests (pytest)
```

- No test coverage regressions.
- New features should include tests; bug fixes should include a regression test.

## Validation Checklist

Before opening a PR, confirm:

- [ ] `bash scripts/repo-setup-audit.sh` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm lint:engine` passes (if engine was changed)
- [ ] `pnpm test:engine` passes (if engine was changed)
- [ ] No secrets in code, docs, or test fixtures

## Architecture

For a full overview of the system architecture, deployment topology, and AI collaboration guidelines, see:

- [Architecture Guide](docs/ai/architecture.md)
- [Agent Operations](AGENTS.md)
