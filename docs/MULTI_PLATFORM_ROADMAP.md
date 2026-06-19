# Multi-Platform Roadmap

Current source of truth for Pluto.hk / 虾子曰 multi-platform migration phases.

## Guardrails

- Production `CONTENT_REPOSITORY` remains `json` until Phase 4 is explicitly approved.
- Do not connect to or mutate production Supabase during local or staging validation.
- Keep legacy JSON content and GitHub Contents API publishing in place.
- Do not introduce Authing, Mini Program, iOS App, or Android App work before their phases.
- Do not commit new PNG, JPG, WebP, or other poster binaries.

## Completed Phases

### Phase 0: Safety Baseline

Status: complete.

- Established baseline checks before structural migration.
- Confirmed existing bilingual homepage, archive, poster preview, share, and Studio surfaces.
- Commit: `18c9063 Phase 0: establish safety baseline`.

### Phase 1: npm Workspaces + Turborepo Monorepo

Status: complete.

- Migrated the web app into an npm workspace monorepo.
- Added Turborepo orchestration without rewriting the app.
- Commit: `7c63633 Phase 1: migrate web app to npm workspace`.

### Phase 2: Shared Contracts, Domain, Config, API Client

Status: complete.

- Extracted shared `@xiazi/contracts`, `@xiazi/domain`, `@xiazi/config`, and `@xiazi/api-client`.
- Kept Issue, Topic, Source, Poster, and Job contracts reusable for later platforms.
- Commit: `a0e7780 Phase 2: extract shared product packages`.

### Phase 3: Supabase Content Base

Status: complete.

- Added Supabase content schema v2.
- Added idempotent importer.
- Added Repository abstraction and JSON/Supabase parity checks.
- Production data source remains JSON.
- Commits:
  - `b3cd612 Phase 3A: add Supabase content schema v2`
  - `dffab4e Phase 3B: add idempotent content importer`
  - `9e9c5fe Phase 3C: add content repositories and parity checks`

### Phase 3.5: Local Supabase Validation

Status: local validation complete; staging validation pending.

- Added Supabase CLI local configuration.
- Validated local Docker + Supabase startup and `db reset`.
- Imported all unique JSON issues into local Supabase.
- Verified second import is idempotent: no duplicate issues, topics, localizations, sources, revisions, or content versions.
- Verified JSON and Supabase repositories compare with exit code 0.
- Verified database constraints and RPC permissions locally.
- Commits:
  - `fc81f71 Phase 3.5A: align config docs and Supabase key support`
  - `e9e6ac5 Phase 3.5B: add local Supabase CLI configuration`
  - Phase 3.5C pending in this working session.

## Future Phases

### Phase 4: Shadow Supabase Reads

Goal: connect Vercel Preview to staging Supabase and compare JSON vs Supabase reads without changing production behavior.

- Create and validate `pluto-staging` Supabase.
- Push migrations to staging.
- Import a controlled content subset, then all required validation content.
- Run verify and compare against staging.
- Add shadow-read instrumentation in Preview only.
- Do not set production `CONTENT_REPOSITORY=supabase`.

### Phase 5: Controlled Data Source Switch

Goal: gradually switch read paths after staging and shadow reads prove parity.

- Enable Supabase reads behind explicit environment flags.
- Keep JSON fallback available.
- Monitor parity, latency, and error rates.
- Preserve GitHub publishing until replacement write paths are proven.

### Phase 6: Multi-Platform API Expansion

Goal: expose stable server-driven content APIs for Web, Mini, and Mobile.

- Reuse `@xiazi/contracts` instead of duplicating types.
- Keep content, ordering, image URLs, and feature flags server-driven.
- Do not force shared UI across platforms.

### Phase 7: Native Platform Builds

Goal: implement Mini Program and mobile apps after shared content APIs are stable.

- Build platform-native UI.
- Integrate identity through internal UUID mapping.
- Keep publishing operations auditable and reversible.
