# Multi-Platform Roadmap

Current source of truth for Pluto.hk / 虾子曰 multi-platform migration phases.

## Guardrails

- Production `CONTENT_REPOSITORY` remains `json` until Phase 4 is explicitly approved.
- Do not mutate Production Supabase outside an explicitly approved phase and guarded script.
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

Status: complete.

- Added Supabase CLI local configuration.
- Validated local Docker + Supabase startup and `db reset`.
- Imported all unique JSON issues into local Supabase.
- Verified second import is idempotent: no duplicate issues, topics, localizations, sources, revisions, or content versions.
- Verified JSON and Supabase repositories compare with exit code 0.
- Verified database constraints and RPC permissions locally.
- Commits:
  - `fc81f71 Phase 3.5A: align config docs and Supabase key support`
  - `e9e6ac5 Phase 3.5B: add local Supabase CLI configuration`
  - `e2ccf9a Phase 3.5C: validate local Supabase content parity`

### Phase 3.6: Hosted Staging Validation

Status: complete.

- Validated `pluto-staging` Supabase migrations and idempotent content import.
- Verified JSON/Supabase compare returns zero differences in staging.
- Confirmed Vercel Preview uses Staging Supabase while Production remains JSON.
- Added remote staging E2E coverage.
- Commit: `5bb5c69 Phase 3.6: validate hosted Supabase staging and preview`.

### Phase 4A: Production Shadow Supabase Reads

Status: in progress.

- Supabase project `cxjftltkdbsxxjgmxvsm` is promoted from validated Staging to Pluto Production Supabase.
- Local Docker Supabase now carries development, migration, import-test, and destructive staging validation duties.
- Vercel Preview defaults to JSON and must not retain Production Supabase Secret.
- Vercel Production keeps JSON as the official response source and uses Supabase only for protected shadow compare.
- Commits:
  - `ac423df Phase 4A: add production content shadow reads`
  - `fc4a466 Phase 4A: guard production repository switch`

## Future Phases

### Phase 4B: Studio Shadow Writes

Goal: keep GitHub as primary write path while shadow-writing content changes to Production Supabase with alerts on mismatch.

### Phase 4C: Supabase Primary Reads

Goal: switch production reads to Supabase with JSON fallback after a clean observation window.

### Phase 4D: Supabase Primary Writes

Goal: make Supabase the primary content write path while retaining emergency snapshots.

### Phase 4E: Retire Runtime GitHub Binary Publishing

Goal: remove production GitHub content writes and stop committing poster binaries after Supabase/COS write paths are proven.

### Legacy Phase 4: Staging Shadow Supabase Reads

Superseded by completed Phase 3.6. Historical goal: connect Vercel Preview to staging Supabase and compare JSON vs Supabase reads without changing production behavior.

- Create and validate `pluto-staging` Supabase.
- Push migrations to staging.
- Import a controlled content subset, then all required validation content.
- Run verify and compare against staging.
- Add shadow-read instrumentation in Preview only.
- Do not set production `CONTENT_REPOSITORY=supabase`.

### Future Hosted Staging Restoration

Goal: restore an independent hosted Staging Supabase project after upgrading Supabase capacity or needing long-lived preview database validation.

### Phase 5: User Identity Foundation

Goal: introduce internal user UUID identity mapping after content source migration is stable.

### Phase 6: Mini Program

Goal: build WeChat Mini Program after shared content APIs are stable.

### Phase 7: Native Mobile Apps

Goal: implement iOS and Android apps after Mini Program and shared APIs are stable.

### Future API Expansion

Goal: expose stable server-driven content APIs for Web, Mini, and Mobile.

- Reuse `@xiazi/contracts` instead of duplicating types.
- Keep content, ordering, image URLs, and feature flags server-driven.
- Do not force shared UI across platforms.
