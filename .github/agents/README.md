# GitHub Copilot custom agents

This folder contains **Copilot custom agent profiles** for this repository.
Each profile uses GitHub's `*.agent.md` format with YAML frontmatter and a
specialized instruction body.

## Agent profiles

### Commander (full-access)

- **`repo-commander.agent.md`** — Top-level operations agent with full repo
  access. Manages PRs, adjusts settings, orchestrates CI/CD, dispatches
  specialists, and enforces quality/security standards across the entire
  repository.

### Specialists (narrow-scope)

- `platform-sync-auditor.agent.md` — Deployment drift and workflow permission checks.
- `runtime-smoke-guardian.agent.md` — Post-deploy health probes and promotion gating.
- `supabase-boundary-guardian.agent.md` — Supabase RLS/auth, typegen, and CLI hygiene.
- `pr-owner-operator.agent.md` — PR risk classification and merge decisions.

## Architecture

```text
┌──────────────────────────┐
│     repo-commander       │  ← full access, top-level orchestrator
│  (PRs, settings, CI/CD)  │
└────────┬─────────────────┘
         │ dispatches
    ┌────┴────┬──────────────┬──────────────────┐
    ▼         ▼              ▼                  ▼
platform-  runtime-     supabase-         pr-owner-
sync-      smoke-       boundary-         operator
auditor    guardian      guardian
```

`repo-commander` automatically dispatches specialist agents when a PR touches
their scope. Specialists return structured JSON verdicts that feed into the
commander's merge decision.

## Trigger mapping

| Trigger files / events                                  | Specialist dispatched        |
| ------------------------------------------------------- | ---------------------------- |
| `.github/workflows/**`, `vercel.json`, `railway.toml`   | `platform-sync-auditor`      |
| Deploy/release workflows, push to main                  | `runtime-smoke-guardian`     |
| `supabase/**`, typegen, auth/env docs                   | `supabase-boundary-guardian` |
| Any PR (risk classification + merge gate)               | `pr-owner-operator`          |

## Environment setup

The Copilot coding agent environment is configured in
`.github/copilot-setup-steps.yml`, which installs Node 22 + pnpm, Python 3.12 +
uv, and the engine virtualenv — matching the CI pipeline in `ci.yml`.
