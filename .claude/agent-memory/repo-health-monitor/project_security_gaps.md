---
name: Security configuration gaps
description: Code scanning and secret scanning disabled, branch protection rules not configured, picomatch vulnerabilities open
type: project
---

As of 2026-03-25, the repository has several security configuration gaps:

1. **Code scanning (CodeQL) is disabled** -- no static analysis running.
2. **Secret scanning is disabled** -- accidental secret commits would not be caught.
3. **Branch protection rules are empty** -- main is marked "protected" but no actual rules are configured (no required reviews, no required status checks, no force-push restrictions).
4. **6 open Dependabot alerts for picomatch** (3 HIGH, 3 MEDIUM) -- Dependabot update PRs are queued.
5. **1 open low-severity Pygments ReDoS alert** -- no upstream fix available, already ignored in pip-audit.

**Why:** This is a trading application handling financial data and API keys. Security posture is important.

**How to apply:** When reviewing repo health, flag these gaps. Recommend enabling code scanning, secret scanning, and configuring branch protection rules with required reviews and status checks.
