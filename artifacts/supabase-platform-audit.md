# Supabase Platform Audit

- Status: **FAIL**

## Blocking Findings

- Supabase type generation workflow uses `version: latest` for Supabase CLI, introducing drift risk for generated types.

## Warnings

- Type generation is skipped when SUPABASE\_\* secrets are unavailable; migration/type drift may survive PR validation.

## Dashboard-only blockers

- Could not validate Supabase project settings (auth redirect URLs, RLS enforcement state) without dashboard/API credentials.
