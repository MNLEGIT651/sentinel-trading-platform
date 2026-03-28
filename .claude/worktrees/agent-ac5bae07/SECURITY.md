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

- **Dependency scanning**: Dependabot monitors all ecosystems weekly.
- **Security audits**: `npm audit` and `pip-audit` run daily via GitHub Actions.
- **Secret detection**: No secrets are committed to the repository; CI validates this.
- **Least-privilege CI**: All workflows use minimal `permissions` blocks.
