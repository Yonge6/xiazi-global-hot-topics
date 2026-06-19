# Content Data Migration

Phase 3 establishes a Supabase content base while keeping Pluto.hk production on JSON. Phase 4A may use Production Supabase for shadow reads only; public responses must still come from JSON.

## Scope

- Source JSON: `apps/web/data/current-issue.json` and `apps/web/data/archive/*.json`.
- Excluded mirrors: `apps/web/public/data/**`.
- Binary poster files are not uploaded, copied, or committed by the importer.
- `CONTENT_REPOSITORY=json` remains the default.

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
```

`SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` are preferred. Legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` remain supported as server-side fallback variables. Secret keys must never be placed in `NEXT_PUBLIC_*` variables or committed.

`SUPABASE_ENV=production` is refused by default. Production import in Phase 4A requires `--allow-production`, a prior `--dry-run`, and the exact confirmation phrase `IMPORT TO PLUTO PRODUCTION` or the non-interactive `PLUTO_PRODUCTION_IMPORT_CONFIRM` variable. Phase 3/4A must not set production `CONTENT_REPOSITORY=supabase`.

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
