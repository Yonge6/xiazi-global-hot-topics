# Content Data Migration

Phase 3 establishes a Supabase content base while keeping Pluto.hk production on JSON.

## Scope

- Source JSON: `apps/web/data/current-issue.json` and `apps/web/data/archive/*.json`.
- Excluded mirrors: `apps/web/public/data/**`.
- Binary poster files are not uploaded, copied, or committed by the importer.
- `CONTENT_REPOSITORY=json` remains the default.

## Local Or Staging Setup

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

`SUPABASE_ENV=production` is refused by default. Phase 3 must not use production Supabase and must not set production `CONTENT_REPOSITORY=supabase`.

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
