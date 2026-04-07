# GitHub Copilot custom agents (deployment-platform specialists)

This folder contains **actual Copilot custom agent profiles** for this repository.
Each profile uses GitHub's `*.agent.md` format with YAML frontmatter and a
specialized instruction body.

## Agent profiles

- `platform-sync-auditor.agent.md`
- `runtime-smoke-guardian.agent.md`
- `supabase-boundary-guardian.agent.md`
- `pr-owner-operator.agent.md`

## Why this structure

- Uses Copilot-native custom agent profiles in `.github/agents`.
- Keeps specialist responsibilities narrowly scoped.
- Uses deterministic, machine-readable output contracts so PR gates are auditable.

## Trigger mapping (used by `pr-owner-operator`)

- Deployment/workflow/docs/config drift:
  - `platform-sync-auditor`
- Runtime health/deploy verification:
  - `runtime-smoke-guardian`
- Supabase migration/typegen/auth-env boundary checks:
  - `supabase-boundary-guardian`
