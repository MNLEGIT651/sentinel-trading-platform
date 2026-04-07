# Commit Signing Policy

## Protected branches

- `main`
- `release/*`

## Enforcement

- CI verifies commit trust status with `git log --pretty='%H %G?'` via `scripts/check-commit-signatures.sh`.
- Required trust status is `%G? = G` (**trusted-good**) for all newly introduced commits.
- Any status other than `G` fails CI unless explicitly grandfathered in `docs/security/commit-signing-exceptions.txt`.
- Platform-native branch protection should also enable **Require signed commits** for `main` and `release/*`.

## Trusted signer source of truth

- `.github/trusted_signers` is the repository trust store used by `git` SSH signature verification.
- Developers and bots must add their signer identities to this file before opening protected-branch PRs.

## Full-history audit and grandfathering

Audit command:

```bash
scripts/audit-commit-signatures.sh
```

Latest audit (2026-04-07 UTC):

- Total legacy exceptions: **297** commits
- Breakdown by `%G?` status:
  - `E` (untrusted/unverifiable): 133
  - `N` (no signature): 162
  - `U` (signature good but trust undefined): 2

The generated exception file (`docs/security/commit-signing-exceptions.txt`) is the approved grandfather list for pre-policy history. New commits must not be added to this file without explicit security review.
