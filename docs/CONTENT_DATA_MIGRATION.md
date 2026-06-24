# Content Data Migration

Phase 3 establishes a Supabase content base while keeping Pluto.hk production on JSON. Phase 4A may use Production Supabase for shadow reads only; public responses must still come from JSON.

## Scope

- Source JSON: `apps/web/data/current-issue.json` and `apps/web/data/archive/*.json`.
- Excluded mirrors: `apps/web/public/data/**`.
- Binary poster files are not uploaded, copied, or committed by the importer.
- `CONTENT_REPOSITORY=json` remains the default.
- `STUDIO_SHADOW_WRITE_ENABLED=false` remains the default until Phase 4B closed-state deployment checks pass.

## Local And Staging Setup

Local Docker Supabase is the active development and staging validation environment. It is used for migrations, import tests, destructive constraint checks, and mapper/RPC debugging.

```bash
supabase start
supabase db reset
npm run content:import
npm run content:verify
npm run content:compare
```

Required environment variables:

```env
SUPABASE_ENV=local
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
CONTENT_REPOSITORY=json
STUDIO_SHADOW_WRITE_ENABLED=false
```

`SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` are preferred. Legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` remain supported as server-side fallback variables. Secret keys must never be placed in `NEXT_PUBLIC_*` variables or committed.

`SUPABASE_ENV=production` is refused by default. Production import in Phase 4A requires `--allow-production`, a prior `--dry-run`, and the exact confirmation phrase `IMPORT TO PLUTO PRODUCTION` or the non-interactive `PLUTO_PRODUCTION_IMPORT_CONFIRM` variable. Phase 3/4A must not set production `CONTENT_REPOSITORY=supabase`.

## Phase 4B Studio Shadow Writes

Phase 4B code can be deployed before the behavior is enabled. The switch is server-only:

```env
STUDIO_SHADOW_WRITE_ENABLED=false
CONTENT_REPOSITORY=json
```

When `STUDIO_SHADOW_WRITE_ENABLED` is unset or `false`, Studio keeps the existing GitHub JSON primary write flow and does not call the Supabase shadow RPC or write `studio_publish_runs`. When set to `true`, Studio publishes one validated canonical Issue Bundle to GitHub first, then attempts Supabase shadow write and compare. Supabase failure, timeout, or mismatch must be recorded and shown in Studio, but must not roll back or block the GitHub primary publish.

Emergency rollback is to set `STUDIO_SHADOW_WRITE_ENABLED=false` and redeploy. Do not delete the Phase 4B migration, delete `studio_publish_runs`, switch `CONTENT_REPOSITORY`, or remove already published JSON content.

## Phase 4B.1 Automation Shadow Bridge

Daily ChatGPT/Codex automation remains a GitHub JSON primary publisher. It does not hold Production Supabase secrets. After `data/current-issue.json` changes on `main`, `.github/workflows/sync-published-issue-shadow.yml` runs in GitHub Actions, reads the exact pushed commit, validates `data/current-issue.json` and `data/archive/YYYY-MM-DD.json`, computes the canonical checksum, writes Supabase Shadow, runs compare, and records a Publish Run with `trigger_type=automation` and the real GitHub commit SHA.

The workflow requires GitHub Actions Secrets:

```env
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

The action must not write GitHub, upload posters, or expose secrets in logs or artifacts. Reruns are idempotent through the publish request id `automation:{commitSha}:{issueDate}:{checksum}` and the shared Supabase shadow sync lock.

`GET /api/internal/publish-runs/status` is a protected, read-only observer endpoint for automation checks. It requires `PUBLISH_RUN_STATUS_SECRET`, `SHADOW_COMPARE_SECRET`, or `CRON_SECRET` as a Bearer token and returns only publish status metadata, short commit SHA, counts, retry count, and timestamps.

## Phase 4A Shadow Reads

The validated hosted Supabase project `cxjftltkdbsxxjgmxvsm` is promoted to the logical Pluto Production Supabase role. There is temporarily no independent hosted Staging project; Vercel Preview defaults back to JSON. A hosted Staging project should be restored later when the project needs paid Supabase capacity, long-lived preview database validation, or parallel team development.

Production shadow compare uses these server-only variables:

```env
SUPABASE_ENV=production
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SHADOW_COMPARE_ENABLED=true
SHADOW_COMPARE_SECRET=
CONTENT_REPOSITORY=json
```

`POST /api/internal/content-shadow-compare` and the Vercel Cron path require `SHADOW_COMPARE_SECRET` or `CRON_SECRET`. The endpoint records only issue date, difference paths, counts, durations, request id, and error code. It must not log full content, source URLs, secrets, or database passwords.

## Import Idempotency

The importer validates every Issue with `@xiazi/contracts`, applies extra publication checks, computes a stable SHA-256 checksum over canonical JSON, and calls `upsert_issue_bundle`.

Expected second-run behavior:

- no duplicate issues, topics, localizations, or sources;
- no content version increase for identical content;
- no duplicate revision for identical checksum.

## Verification

`npm run content:verify` reads Supabase through `SupabaseContentRepository`, maps snake_case rows back to the Issue contract, and validates:

- each issue has 9 topics;
- ranks are exactly 1-9;
- both `zh-CN` and `en-US` localizations exist;
- every topic has at least one source;
- `featuredTopicId` belongs to the issue;
- timestamps represent the same instant;
- no orphan localization/source rows exist;
- no duplicate current poster metadata exists.

## Compare

`npm run content:compare` compares JSON Repository output with Supabase Repository output.

Exit codes:

- `0`: all compared content matches;
- `1`: data differences were found;
- `2`: environment or connection error.
