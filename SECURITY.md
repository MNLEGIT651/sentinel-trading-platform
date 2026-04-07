# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in the Sentinel Trading Platform, please
report it responsibly.

**Do NOT open a public issue.** Instead, use one of the following channels:

1. **GitHub Private Vulnerability Reporting** (preferred)
   Navigate to the repository **Security** tab → **Advisories** → **Report a vulnerability**.

2. **Email**
   Send details to the repository owner via the contact information on their
   GitHub profile.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected component (`apps/web`, `apps/engine`, `apps/agents`, `packages/shared`)
- Impact assessment (data exposure, privilege escalation, denial of service, etc.)

### Response Timeline

| Step                     | Target   |
| ------------------------ | -------- |
| Acknowledgement          | 48 hours |
| Initial triage           | 5 days   |
| Fix or mitigation issued | 30 days  |

## Security Practices

- **Branch protection**: `main` requires pull request reviews, passing CI status
  checks (Test Web, Test Engine, Test Agents), up-to-date branches, conversation
  resolution, signed commits, and linear history.
- **Dependency scanning**: Dependabot monitors all ecosystems weekly with alerts,
  security updates, grouped security updates, and malware alerts enabled.
- **Security audits**: `pnpm audit` and `pip-audit` run in CI via
  `scripts/security-audit.mjs`; `scripts/repo-setup-audit.sh` verifies
  repository-level settings.
- **Secret scanning & push protection**: GitHub secret scanning is enabled with
  push protection to block commits containing secrets before they reach the
  repository.
- **Code scanning (CodeQL)**: CodeQL default setup is enabled, analyzing
  JavaScript/TypeScript and Python for security vulnerabilities on every push
  and pull request.
- **Least-privilege CI**: All workflows use minimal top-level `permissions`
  blocks and actions are pinned to full-length commit SHAs.
