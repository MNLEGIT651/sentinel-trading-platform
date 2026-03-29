# @sentinel/shared

Shared TypeScript type contracts for the Sentinel Trading Platform.

## Overview

This package contains the canonical type definitions shared between `@sentinel/web` and `@sentinel/agents`. It is consumed as a workspace dependency — no build step required.

## Usage

```typescript
import type { Strategy, Signal, PortfolioSummary } from '@sentinel/shared';
```

## Structure

```text
src/
├── index.ts               # Barrel export
├── types.ts               # Core domain types
├── state-machine.ts       # Recommendation state machine
└── types/
    └── database.types.ts  # Supabase-generated types
```

## Updating Database Types

When the Supabase schema changes, regenerate types:

```bash
npx supabase gen types typescript --project-id <project-id> > packages/shared/src/types/database.types.ts
```

## Adding New Types

1. Define the type in `src/types.ts`
2. Export it from `src/index.ts`
3. Run `pnpm lint` to verify
4. Update consumers in `apps/web` and `apps/agents` as needed

## Conventions

- All types are **interfaces** or **type aliases** — no runtime code
- No external dependencies — this package has zero runtime deps
- Changes here affect both web and agents — validate both after editing
