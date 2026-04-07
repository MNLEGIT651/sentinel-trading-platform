# Security Controls Mapping

Maps Sentinel's security controls to OWASP ASVS v4.0 and NIST SSDF categories.

## OWASP Top 10 Coverage

| OWASP Category                | Control                                                      | Implementation                                                |
| ----------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| A01 Broken Access Control     | Supabase RLS + middleware auth gate                          | `proxy.ts`, `supabase/migrations/00002_*`                     |
| A02 Cryptographic Failures    | TLS enforced, HSTS header, no plaintext secrets              | `next.config.ts`, `.env.example`                              |
| A03 Injection                 | Supabase parameterized queries, Zod validation               | `engine/src/api/validators.py`, shared types                  |
| A04 Insecure Design           | Human-in-the-loop trade approval, risk circuit breakers      | `agents/src/orchestrator.ts`, `engine/src/risk/`              |
| A05 Security Misconfiguration | CSP headers, Dependabot, workflow lint + fail-fast CI gates  | `.github/workflows/`, `next.config.ts`                        |
| A06 Vulnerable Components     | Dependabot, dependency-review, pip-audit, pnpm audit         | `.github/dependabot.yml`, `scripts/security-audit.mjs`        |
| A07 Auth Failures             | Supabase Auth, session refresh, rate limiting                | `proxy.ts`, `lib/supabase/`                                   |
| A08 Software/Data Integrity   | Lockfile pinning, dependency-review workflow                 | `pnpm-lock.yaml`, `.github/workflows/dependency-review.yml`   |
| A09 Logging/Monitoring        | Structured logging, workflow_runs table, Vercel Analytics    | `agents/src/logger.ts`, `supabase/migrations/00004_*`         |
| A10 SSRF                      | Proxy restricts upstream to configured ENGINE_URL/AGENTS_URL | `lib/server/service-config.ts`, `lib/server/service-proxy.ts` |

## CI/CD Security Pipeline

| Workflow                   | Purpose                                          | Frequency                      |
| -------------------------- | ------------------------------------------------ | ------------------------------ |
| `ci.yml`                   | Lint, test, build, and repository security audit | Every push/PR                  |
| `dependency-review.yml`    | Block PRs with vulnerable dependency updates     | Dependency changes             |
| `gitleaks.yml`             | Secret scanning on source history                | Every push/PR to main          |
| `workflow-lint.yml`        | Enforce required workflow inventory              | Workflow/script changes        |
| `railway-deploy.yml`       | Backend deploy with fail-fast health checks      | Pushes to `main` backend paths |
| `vercel-preview-smoke.yml` | Mandatory synthetic proxy health validation      | Web/shared changes + manual    |

## NIST SSDF Practice Mapping

| SSDF Practice                 | Control                                                   |
| ----------------------------- | --------------------------------------------------------- |
| PO.1 (Security requirements)  | Architecture docs, threat model via OWASP Top 10 mapping  |
| PS.1 (Protect software)       | Branch protection, CODEOWNERS, signed commits             |
| PW.1 (Design secure)          | Service isolation, RLS, proxy architecture                |
| PW.5 (Create source code)     | ESLint strict, TypeScript strict, Ruff for Python         |
| PW.6 (Verify)                 | Vitest, Pytest, Playwright E2E, coverage gates            |
| PW.7 (Security testing)       | Gitleaks, dependency-review, pnpm audit, pip-audit        |
| PW.8 (Secure build)           | Lockfile pinning, Docker multi-stage, non-root containers |
| RV.1 (Vulnerability response) | Dependabot, dependency-review, CI security audit          |
