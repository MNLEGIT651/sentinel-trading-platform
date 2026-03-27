# 🔒 Sentinel Dependency Security Report — 2026-03-22

**Scan completed:** 2026-03-22
**Project root:** `/Stock Trading App` (pnpm workspace, 212 prod deps scanned)
**Tool versions:** pnpm audit 10.32.1 · pip-audit 2.10.0

---

## ⚠️ Summary: No CRITICAL or HIGH findings. 5 MODERATE/LOW in Next.js — upgrade available.

---

## npm Audit

### Severity Summary

| Severity    | Count |
| ----------- | ----- |
| 🚨 Critical | 0     |
| 🔴 High     | 0     |
| 🟡 Moderate | 4     |
| 🔵 Low      | 1     |
| **Total**   | **5** |

### Findings

All 5 findings are in a single package: **`next@16.1.6`** (direct dependency in `apps/web`). Fixed in **`next@16.1.7`**.

| Severity | CVE            | Advisory                   | Title                                                         | Dependency Type            |
| -------- | -------------- | -------------------------- | ------------------------------------------------------------- | -------------------------- |
| Moderate | CVE-2026-29057 | GHSA-ggv3-7p47-pfv8        | HTTP request smuggling in rewrites                            | Direct (`apps/web > next`) |
| Moderate | CVE-2026-27980 | GHSA-3x4c-7xq6-9pq8        | Unbounded `next/image` disk cache growth (DoS)                | Direct (`apps/web > next`) |
| Moderate | CVE-2026-27979 | GHSA-\* (advisory 1114942) | See detail below                                              | Direct (`apps/web > next`) |
| Moderate | CVE-2026-27978 | GHSA-mq59-m269-xvcx        | `null` origin bypasses Server Actions CSRF checks             | Direct (`apps/web > next`) |
| Low      | CVE-2026-27977 | GHSA-jcc7-9wpm-mj36        | `null` origin bypasses dev HMR WebSocket CSRF (dev mode only) | Direct (`apps/web > next`) |

### Finding Details

**CVE-2026-29057 — HTTP Request Smuggling (Moderate)**
Crafted `DELETE`/`OPTIONS` requests using `Transfer-Encoding: chunked` could allow request smuggling through rewritten routes, potentially reaching internal/admin backend endpoints. **Note:** Does not affect apps hosted on Vercel (CDN handles rewrites).

**CVE-2026-27980 — Unbounded Image Cache Growth (Moderate)**
No upper bound on `/_next/image` disk cache allows an attacker to exhaust disk via unique image variant requests (DoS). **Note:** Does not affect Vercel-hosted deployments.

**CVE-2026-27979 — (details in advisory 1114942, same next@16.1.6 → fix 16.1.7)**

**CVE-2026-27978 — Server Actions CSRF via null origin (Moderate)**
`origin: null` was treated as a missing origin during Server Action CSRF validation, allowing sandboxed iframes to submit state-changing actions with victim credentials.

**CVE-2026-27977 — Dev HMR WebSocket CSRF via null origin (Low, dev mode only)**
If a dev server is reachable from attacker-controlled content, `Origin: null` bypassed cross-site WebSocket protection. Production-only deployments are not affected.

---

## Python Audit (apps/engine)

**Status: ✅ Clean — no known vulnerabilities found**

Packages audited (pip-audit 2.10.0, resolved to latest matching versions):

| Package              | Resolved Version | Vulns |
| -------------------- | ---------------- | ----- |
| fastapi              | 0.135.1          | None  |
| uvicorn              | 0.42.0           | None  |
| pydantic             | 2.12.5           | None  |
| pydantic-settings    | 2.13.1           | None  |
| httpx                | 0.28.1           | None  |
| numpy                | 2.2.6            | None  |
| pandas               | 2.3.3            | None  |
| python-dotenv        | 1.2.2            | None  |
| postgrest            | 2.28.3           | None  |
| starlette            | 0.52.1           | None  |
| certifi              | 2026.2.25        | None  |
| + 29 transitive deps | —                | None  |

---

## Anthropic SDK

|                                      | Version        |
| ------------------------------------ | -------------- |
| Pinned in `apps/agents/package.json` | `^0.80.0`      |
| Latest on npm                        | `0.80.0`       |
| **Status**                           | **✅ Current** |

---

## Action Items

Since there are no CRITICAL or HIGH findings, these are non-urgent but should be addressed in the next routine dependency update cycle:

1. **Upgrade `next` in `apps/web`** (resolves all 5 npm findings):

   ```bash
   cd "apps/web"
   pnpm add next@^16.1.7
   # then verify build
   pnpm build
   ```

2. **If self-hosting (not on Vercel)**, the request smuggling (CVE-2026-29057) and disk cache DoS (CVE-2026-27980) are higher priority — upgrade promptly and consider adding edge-level mitigations until deployed.

3. **No Python action required** — engine dependencies are clean.

4. **Anthropic SDK is current** — no action needed.

---

## Notes

- `pnpm` was not in `$PATH` on the audit runner; installed temporarily to perform the scan.
- Python audit used `--no-deps` against `pyproject.toml` deps directly (avoids installing the full project); covers production dependency surface area.
- Audit was run against the lockfile (`pnpm-lock.yaml`) for npm and resolved latest matching specifiers for Python.
- Next.js CVE-2026-29057 and CVE-2026-27980 are explicitly noted by the advisory as non-impacting on Vercel-hosted deployments. Confirm your hosting environment before triaging.
