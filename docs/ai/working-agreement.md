# AI Working Agreement

This repo supports both Claude Code and Codex. The goal is not to make them behave identically;
the goal is to make them converge on the same repo rules, task boundaries, and validation bar.

## Ownership

- Human owner: product intent, security-sensitive approval, schema approval, release judgment.
- Claude Code: investigation, architecture, debugging, decomposition, review.
- Codex: isolated implementation, test additions, repetitive edits, branch-based execution.

## Mandatory Task Contract

Every AI task should include these fields, whether it starts in chat, an issue, or a PR:

1. Outcome: the user-visible or system-visible result.
2. Scope: files or modules that may change.
3. Validation: commands that must run before handoff.
4. Forbidden changes: paths or behaviors that must stay untouched.

If any of those fields are missing, the agent should infer the smallest safe scope and state it.

## Branch And Worktree Rules

- One task, one branch.
- Use a separate worktree for parallel work when more than one agent is active.
- Never let two agents edit the same file at the same time.
- Rebase or merge only after the owning agent finishes and the branch passes validation.

## Commit Signing Policy (main + release branches)

- Protected targets: `main` and `release/*`.
- Policy: all new commits that land on protected targets must be either **trusted-good** under `git log --pretty='%H %G?'` or marked `verified: true` by the GitHub commit API.
- Trust result required by policy: `%G? == G` or a GitHub-verified commit.
- Any other result (`N`, `E`, `B`, `U`, `X`, `Y`, `R`) is treated as untrusted and fails CI unless the commit SHA is explicitly grandfathered in `docs/security/commit-signing-exceptions.txt`.
- Branch protection should also enable platform-native **Require signed commits** for `main` and `release/*` when available.

### Local setup (developers and bots)

1. Configure SSH commit signing:
   - `git config --global gpg.format ssh`
   - `git config --global user.signingkey <path-to-ssh-public-key-or-key-id>`
   - `git config --global commit.gpgsign true`
2. Ensure repo trust policy is applied:
   - `git config gpg.ssh.allowedSignersFile .github/trusted_signers`
3. Add your signer identity to `.github/trusted_signers` in this repo before opening a PR.
4. Validate your branch before push:
   - `scripts/check-commit-signatures.sh origin/main..HEAD`

Bots must follow the same policy:

- use a dedicated bot signing key,
- add the bot key to `.github/trusted_signers`,
- or rely on GitHub-native verified commits where applicable,
- run `scripts/check-commit-signatures.sh` as part of bot validation before creating PRs.

Recommended branch names:

- `feat/<area>-<outcome>`
- `fix/<area>-<bug>`
- `chore/<area>-<maintenance>`
- `docs/<area>-<topic>`

## Stop-And-Ask Changes

These changes require explicit human approval or a very clear task scope before editing:

- `supabase/migrations/*`
- `package.json`
- `pnpm-lock.yaml`
- `.env.example`
- `.github/workflows/*`
- `vercel.json`
- shared contracts in `packages/shared/src/*`
- engine auth or config in `apps/engine/src/api/main.py` and `apps/engine/src/config.py`

## Repo-Specific Guardrails

- Web client calls to the engine must use `apps/web/src/lib/engine-fetch.ts`.
- Server-side engine access in the agents app goes through `apps/agents/src/engine-client.ts`.
- Do not add API key entry forms to the settings page.
- Keep offline states visible with `OfflineBanner`.
- Keep simulated or fallback market data labeled with `SimulatedBadge`.

## Collaboration Loops

Use the lightest loop that fits the task.

### Small Fix

1. One agent implements on a fresh branch.
2. Run the targeted validation from `docs/ai/commands.md`.
3. Open a PR with the required scope and validation details.

### Bug Or Ambiguous Failure

1. Claude reproduces or narrows the root cause.
2. Codex or Claude implements the fix on an isolated branch.
3. Claude or the human reviewer checks for contract drift and missing tests.

### Large Refactor

1. Claude writes the decomposition and identifies shared-risk boundaries first.
2. Codex handles bounded subtasks on separate branches or worktrees.
3. Final review checks architecture consistency before merge.

## Handoff Standard

Every handoff or PR must include:

- what changed
- what stayed intentionally unchanged
- exact commands run
- pass/fail status
- unresolved risks or assumptions

Use `docs/ai/task-template.md` when you need a copy-paste prompt skeleton.
