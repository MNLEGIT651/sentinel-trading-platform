# Commit Signing Policy

## Goal

All new commits to protected branches should be signed with a verified GPG or SSH key.
This ensures traceability and prevents commit author spoofing.

## Current Status

- **Enforcement level**: Advisory (warnings only)
- **Target**: Blocking for `main` branch after all contributors have signing configured

## How to Set Up Signing

### GPG Signing

```bash
# Generate a GPG key (if you don't have one)
gpg --full-generate-key

# List your key ID
gpg --list-secret-keys --keyid-format=long

# Configure git to use it
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true
```

### SSH Signing (Git 2.34+)

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
```

## CI Integration

The `scripts/check-commit-signatures.sh` script audits commits in CI:

- **Default mode**: Warns about unsigned commits but does not fail the build
- **Strict mode**: Set `STRICT=true` env var to fail on unsigned commits

## Exception List

Legacy unsigned commits are tracked in `docs/security/commit-signing-exceptions.txt`.
Each line contains a full commit SHA that is exempt from the signing requirement.
