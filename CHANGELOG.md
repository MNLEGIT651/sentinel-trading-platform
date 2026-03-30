# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Advisor memory system with 3-tier architecture (profiles, preferences, conversations)
- Explainable recommendations with structured explanation payloads
- Backend production hardening (requireAuth, API error helpers, route auth enforcement)
- 85 new tests across advisor routes, auth, API errors, and components
- Advisor hub page (`/advisor`) with memory management UI
- 12 new advisor UI components (ProfileEditor, MemoryPanel, ExplanationCard, etc.)
- Shared advisor type system in `@sentinel/shared`
- 3 Supabase migrations (advisor tables, indexes, RLS tightening)

### Changed

- Removed 6 unused GitHub Actions workflows (performance-benchmarks, test-coverage, secrets-scan, workflow-lint, auto-label, stale-management)
- Slimmed CI pipeline to 4 essential workflows

### Fixed

- Tightened catalyst_events RLS policy from always-true to user_id scoped
- Fixed lint warnings in test files

## [0.1.0] — 2026-03-30

### Added

- Initial release: Next.js dashboard, Python FastAPI engine, TypeScript agent orchestrator
- Supabase-backed state with 56 tables and RLS policies
- Comprehensive CI/CD with GitHub Actions
- Paper-trading experiment framework
- Decision journal and trade memory
- Shadow portfolio champion-challenger framework
- Regime detection with playbook management
- Risk preview dialog for trade approvals
- Strategy health and monitoring
- Catalyst overlay with calendar timeline
- Replay/incident mode for point-in-time system state
- Data quality console for feed monitoring
- Durable workflow engine with dashboard health strip
- Operator roles and approval tiers
- Psychology-driven design enhancements
- Responsive device detection and mobile optimization
- Comprehensive auth hardening with failure recovery
- Customer onboarding flow (KYC, bank linking, funding)
