# Commit Signing Policy

## Protected branches

- `main`
- `release/*`

## Enforcement

- CI verifies commit trust status with `git log --pretty='%H %G?'` via `scripts/check-commit-signatures.sh`.
- Required trust status is either `%G? = G` (**trusted-good**) or `commit.verification.verified = true` from the GitHub commit API for all newly introduced commits.
- Any commit that is neither locally trusted nor GitHub-verified fails CI unless explicitly grandfathered in `docs/security/commit-signing-exceptions.txt`.
- Platform-native branch protection should also enable **Require signed commits** for `main` and `release/*`.

## Trusted signer source of truth

- `.github/trusted_signers` is the repository trust store used by `git` SSH signature verification.
- Developers and bots using SSH signing must add their signer identities to this file before opening protected-branch PRs.
- GitHub-generated verified commits (for example GitHub UI merges and Dependabot commits) are accepted through the GitHub commit-verification API fallback used by CI. The API check retries up to 3 times to tolerate transient failures.

## Trusted bot logins

`.github/trusted_bot_logins` lists GitHub App/Bot logins whose unsigned commits are accepted when they match one of two patterns:

1. **Web-flow pattern** — authored by the bot, committed by `web-flow` (GitHub UI), unsigned.
2. **Workflow-push pattern** — authored by the bot, committed by a trusted bot login, noreply email.

Current trusted bots: `Codex`, `Copilot`, `dependabot[bot]`, `github-actions[bot]`.

## Full-history audit and grandfathering

Audit command:

```bash
scripts/audit-commit-signatures.sh
```

Latest audit (2026-04-07 UTC before GitHub-verification fallback):

- Total legacy exceptions: **297** commits
- Breakdown by `%G?` status:
  - `E` (untrusted/unverifiable): 133
  - `N` (no signature): 162
  - `U` (signature good but trust undefined): 2

The generated exception file (`docs/security/commit-signing-exceptions.txt`) is the approved grandfather list for pre-policy history after local-trust and GitHub-verification checks are both applied. New commits must not be added to this file without explicit security review.
