# Sentinel Agents

TypeScript agent orchestrator for the Sentinel Trading Platform.

## Overview

The agents service coordinates AI-powered trading analysis using Claude (Anthropic). It manages a pipeline of specialized agents — Market Sentinel, Strategy Analyst, Risk Monitor, Execution Monitor, and Research Analyst — that analyze market conditions, evaluate strategies, and generate trading recommendations.

## Tech Stack

- **Runtime**: Node.js 22+ with TypeScript
- **Framework**: Express v5
- **AI**: Anthropic Claude SDK
- **Scheduling**: node-cron v4
- **Validation**: Zod v4
- **Database**: Supabase

## Development

### Prerequisites

- Node.js 22+ and pnpm 10.32+

### Setup

```bash
# From repo root
pnpm install
```

### Run locally

```bash
pnpm --filter @sentinel/agents dev
```

### Validate

```bash
pnpm test:agents    # Vitest suite (111 tests)
```

## Architecture

```text
Scheduler (cron)
    │
    ▼
Orchestrator ──► Market Sentinel ──► Strategy Analyst
    │                                      │
    │              Risk Monitor ◄──────────┘
    │                   │
    │              Execution Monitor
    │                   │
    └──────────── Research Analyst
```

Each agent cycle runs sequentially. The orchestrator manages state, cooldowns, and approval workflows via Supabase.

## API Endpoints

| Method | Path                     | Description         |
| ------ | ------------------------ | ------------------- |
| GET    | `/health`                | Health check        |
| GET    | `/status`                | Orchestrator status |
| POST   | `/cycle/start`           | Trigger agent cycle |
| POST   | `/proposals/:id/approve` | Approve a proposal  |
| POST   | `/proposals/:id/reject`  | Reject a proposal   |

## Configuration

| Variable                    | Required | Description               |
| --------------------------- | -------- | ------------------------- |
| `ANTHROPIC_API_KEY`         | Yes      | Claude API key            |
| `ENGINE_URL`                | Yes      | Engine service URL        |
| `SUPABASE_URL`              | Yes      | Supabase project URL      |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Supabase service role key |
