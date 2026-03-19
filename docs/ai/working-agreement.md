# AI Working Agreement

This document is the shared operating contract for humans, Claude Code, Codex, and any other coding agents in this repository.

## Goals

- Maintain cross-service correctness.
- Keep changes easy to review.
- Avoid hidden coupling between web, engine, agents, and database layers.
- Protect trading, data, and secret-handling flows.

## Roles

### Claude Code

Use primarily for:

- architecture analysis,
- debugging and root-cause investigation,
- refactor planning,
- writing or refining team conventions,
- sensitive edits that require careful reasoning.

### Codex

Use primarily for:

- isolated feature work,
- bugfix implementation,
- test creation,
- repetitive or mechanical refactors,
- branch-based PR generation.

## Default collaboration loop

1. Claude or human defines the task and affected surfaces.
2. One agent implements on an isolated branch.
3. Relevant checks are run.
4. A second reviewer (human or another agent) reviews for contract drift, security, and test coverage.
5. Merge only after CI and review checklist pass.

## Branching rules

- One issue or task per branch.
- Do not let two agents write to the same branch concurrently.
- Avoid long-lived AI branches.
- Rebase or merge main frequently for contract-heavy work.

## Task prompt template

When delegating work to an agent, include:

- objective,
- files or modules in scope,
- files explicitly out of scope,
- required checks,
- expected behavior change (or “no behavior change”),
- any security or data-integrity concerns.

## Contract-sensitive areas

Changes in these areas require extra care:

- Engine API routes and response shapes,
- web engine client and app API routes,
- agent recommendations and approvals,
- shared package types,
- Supabase migrations,
- broker and market-data integrations.

## Forbidden shortcuts

- Do not fake API compatibility by changing only types.
- Do not suppress tests instead of fixing breakage.
- Do not commit generated secrets or `.env` contents.
- Do not change migrations retroactively once applied; add a new migration instead.
- Do not make opportunistic refactors during production-facing fixes unless explicitly requested.

## Definition of done

A task is done when:

- code and docs are updated as needed,
- relevant checks were run or blockers were documented,
- interfaces remain aligned across apps,
- the change is reviewable in a focused PR.
