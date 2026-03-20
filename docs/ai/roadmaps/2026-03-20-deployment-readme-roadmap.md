# Deployment + README Implementation Roadmap

> Owner intent: simplify deployment, make project state explicit, and give Claude Code + Codex a shared execution map.

## Outcome

Sentinel has a deployment approach that is easy to explain, easier to operate, and documented from one canonical source. The repo also gains a root README that is accurate, comprehensive, and useful to humans and coding agents.

## Scope

- Deployment architecture docs and runbooks
- README planning and content structure
- Agent execution tracking and startup workflow
- No production code behavior changes in this roadmap document itself

## Validation

- `git diff --check`
- Human review against `AGENTS.md`, `docs/ai/architecture.md`, `docs/ai/commands.md`, and current deployment assets

## Forbidden Changes

- Do not change `package.json`, `pnpm-lock.yaml`, `turbo.json`, `vercel.json`, shared contracts, or migrations as part of documenting the roadmap
- Do not claim a production topology that is not implemented or explicitly marked planned

---

## Program summary

### Program A — Easier deployment

Create one canonical deployment model with the browser talking only to the web app and the web server reaching internal services.

### Program B — Root README

Create a root-level README that is accurate, onboarding-friendly, and explicit about what is production-ready, experimental, and planned.

### Program C — Agent execution system

Create a lightweight operating system for Claude Code and Codex so each session can pick the next unblocked task, claim ownership, report validation, and avoid stepping on active work.

---

## Milestone 1 — Project control plane

### Ticket 1.1 — Create canonical project state ledger
- **Outcome:** A single file tracks active, queued, blocked, and completed work.
- **Files:** `docs/ai/state/project-state.md`
- **Notes:** This becomes the first file both agents read after `AGENTS.md` and the AI docs.

### Ticket 1.2 — Create agent operating instructions for session startup and handoff
- **Outcome:** Claude Code and Codex share the same startup checklist, claim protocol, handoff format, and closeout rules.
- **Files:** `docs/ai/agent-ops.md`
- **Notes:** Must work with the existing `AI task` issue template and repo guardrails.

### Ticket 1.3 — Link the control-plane docs from `AGENTS.md`
- **Outcome:** New sessions are steered into the project-state ledger before editing files.
- **Files:** `AGENTS.md`
- **Notes:** Keep the existing guardrails; only extend the read order and execution expectations.

**Exit criteria:**
- There is one obvious place to see what is in flight
- There is one obvious startup checklist for all agents
- The repo-level instructions point to both

---

## Milestone 2 — Deployment simplification design

### Ticket 2.1 — Write canonical deployment architecture doc
- **Outcome:** One document defines local and production topology, public vs internal services, health checks, and hosting assumptions.
- **Files:** `docs/deployment.md`
- **Depends on:** Ticket 1.1

### Ticket 2.2 — Decide agents service posture
- **Outcome:** `agents` is explicitly marked as either required or optional for first production deployment.
- **Files:** `docs/deployment.md`, `docs/ai/state/project-state.md`
- **Depends on:** Ticket 2.1

### Ticket 2.3 — Write deployment env matrix
- **Outcome:** Every environment variable lists owner service, visibility, and required deployment stage.
- **Files:** `docs/deployment.md`, `.env.example`
- **Depends on:** Ticket 2.1

**Exit criteria:**
- Operators can answer where each service runs and which URLs are public
- Public/browser env vars are clearly separated from internal-only vars

---

## Milestone 3 — Web access path simplification

### Ticket 3.1 — Inventory current browser-to-service fetches
- **Outcome:** A tracked list exists for all browser paths that directly hit engine or agents.
- **Files:** `docs/ai/state/project-state.md` or linked checklist artifact
- **Depends on:** Ticket 2.1

### Ticket 3.2 — Proxy engine access through Next.js route handlers
- **Outcome:** Browser traffic for engine-backed dashboard flows goes through same-origin web routes.
- **Files:** `apps/web/src/app/api/**`, `apps/web/src/app/page.tsx`, related tests
- **Depends on:** Ticket 3.1

### Ticket 3.3 — Proxy agents access through Next.js route handlers
- **Outcome:** Browser traffic for agents-backed flows goes through same-origin web routes or is explicitly disabled for first production.
- **Files:** `apps/web/src/app/api/**`, `apps/web/src/hooks/use-service-health.ts`, `apps/web/src/app/page.tsx`, related tests
- **Depends on:** Ticket 3.1, Ticket 2.2

### Ticket 3.4 — Centralize upstream service resolution
- **Outcome:** `apps/web/src/lib/server/service-config.ts` becomes the single source of truth for URL, auth, timeout, and retry rules.
- **Files:** `apps/web/src/lib/server/service-config.ts`, callers that currently hardcode service config
- **Depends on:** Ticket 3.2, Ticket 3.3

**Exit criteria:**
- The browser can run against one public origin
- Upstream configuration logic is no longer duplicated across multiple callers

---

## Milestone 4 — Deployment asset normalization

### Ticket 4.1 — Audit Dockerfiles against the canonical topology
- **Outcome:** Each Dockerfile is either validated as correct for its role or receives a scoped fix task.
- **Files:** `apps/web/Dockerfile`, `apps/agents/Dockerfile`, `apps/engine/Dockerfile`, `docs/deployment.md`
- **Depends on:** Ticket 2.1

### Ticket 4.2 — Align deployment platform docs
- **Outcome:** Vercel, Railway, and Docker Compose are documented as complementary parts of one strategy instead of three unrelated setups.
- **Files:** `docs/deployment.md`, `README.md`
- **Depends on:** Ticket 4.1

### Ticket 4.3 — Add deployment runbooks
- **Outcome:** Operators have first-deploy, smoke-test, rollback, and troubleshooting guides.
- **Files:** `docs/runbooks/local.md`, `docs/runbooks/production.md`, `docs/runbooks/troubleshooting.md`
- **Depends on:** Ticket 4.2

**Exit criteria:**
- There is a recommended path for local, preview, and production deployment
- Deployment verification steps are documented and repeatable

---

## Milestone 5 — Root README delivery

### Ticket 5.1 — Create root README skeleton
- **Outcome:** A root `README.md` exists and becomes the primary entry point for humans.
- **Files:** `README.md`
- **Depends on:** Ticket 2.1

### Ticket 5.2 — Add architecture, repo map, commands, and validation sections
- **Outcome:** A contributor can understand the system and run the right commands without opening multiple files first.
- **Files:** `README.md`
- **Depends on:** Ticket 5.1

### Ticket 5.3 — Add deployment and env sections with links to deeper docs
- **Outcome:** The README gives a practical summary and links to the full deployment/runbook docs.
- **Files:** `README.md`, `docs/deployment.md`
- **Depends on:** Ticket 4.2

### Ticket 5.4 — Add project maturity and known-gaps section
- **Outcome:** The README is honest about what is implemented, fallback-driven, or planned.
- **Files:** `README.md`
- **Depends on:** Ticket 5.2

**Exit criteria:**
- The README is comprehensive without becoming the only place deployment detail lives
- It points to canonical docs instead of duplicating fast-changing operational detail

---

## Recommended execution order

1. Ticket 1.1
2. Ticket 1.2
3. Ticket 1.3
4. Ticket 2.1
5. Ticket 2.2
6. Ticket 2.3
7. Ticket 3.1
8. Ticket 3.2
9. Ticket 3.3
10. Ticket 3.4
11. Ticket 4.1
12. Ticket 4.2
13. Ticket 4.3
14. Ticket 5.1
15. Ticket 5.2
16. Ticket 5.3
17. Ticket 5.4

---

## Ownership guidance

- **Claude Code:** architecture choices, deployment tradeoffs, review, ambiguity resolution, cross-cutting validation
- **Codex:** isolated implementation tickets, test additions, docs creation, mechanical config cleanup
- **Human owner:** final production topology decision, secret rotation, hosting provider choices, release judgment

---

## Suggested ticket template for issues or PRs

For every ticket above, copy the structure from `.github/ISSUE_TEMPLATE/ai-task.md` and fill in:
- Outcome
- Scope
- Validation
- Forbidden Changes
- Context

Add the ticket ID in the title, for example:
- `docs: T1.1 create project state ledger`
- `web: T3.2 proxy engine dashboard calls through Next.js routes`
- `docs: T5.1 add root README`
