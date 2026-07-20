# Release V2 staging rehearsal evidence

This directory contains only sanitized, machine-verifiable evidence for the isolated Release V2 staging environment. It never contains credentials, reusable signed URLs, production identifiers, or historical publication changes.

## Approved scope

- Independent Supabase project: `xiazi-release-v2-staging` (`ardermdcrzzwzbmlszez`, Singapore).
- Independent Vercel projects: `xiazi-release-v2-reviewer-staging` and `xiazi-release-v2-web-staging`.
- Tencent COS staging bucket verified in Work Package 2, used only through Direct COS Origin.
- `cdnVerificationStatus: not-applicable-for-direct-cos-origin`.
- `cdnSourceHashMatches: null`.
- No production DNS, production Supabase, production Vercel, production COS, CDN, or historical issue mutation.

## Implemented machine gates

- `scripts/tests/staging-rehearsal.test.mjs` rejects production/retired hosts, CDN configuration, mismatched Supabase projects, and non-staging COS buckets.
- `scripts/verify-release-v2-staging.mjs` checks Reviewer protocol/model/deployment identity, Supabase pointer, `/api/content/`, both language pages, all 18 poster redirects, Direct COS bytes, AES256, and content hashes.
- `scripts/prepare-staging-release.ts` creates isolated `STAGING ONLY` Release A/B candidates with 18 bilingual posters using the fixed Xiazi and Doudoulong masters, then uploads them through the verified create-only COS adapter.
- `20260720010000_reviewer_replay_nonce_store.sql` provides a persistent, atomic, service-role-only replay reservation RPC. Only nonce hashes are stored.
- `.github/workflows/release-v2-staging-rehearsal.yml` keeps ordinary code/database gates separate from the protected live staging proof.
- `scripts/staging-reviewer-faults.mjs` proves authentication failure, provider 401/429/500, malformed output, timeout, outage, and cross-instance nonce replay while checking the active pointer before and after every scenario.
- `scripts/staging-source-faults.ts` exercises unsupported and uncertain claims, correction and retraction markers, private redirects, redirect loops, mixed public/private DNS, and streaming body limits.
- `scripts/staging-visual-faults.ts` uses the real uploaded poster bytes with a staging-only controlled negative provider to prove IP, 153-comparison, bilingual-theme, and near-duplicate gates fail closed. The controlled provider is never used for Release A or B.
- `scripts/staging-database-faults.mjs` covers 05:50/06:00 lease contention, idempotent retry, owner isolation, heartbeat, expiry/takeover, old-worker rejection, transactional staging failure, activation failure, authorization failure, and client disconnect.
- `scripts/staging-storage-faults.ts` plus the protected COS verifier cover missing objects, incomplete manifests, manifest hash changes, overwrite, delete, copy, multipart, policy mutation, encryption, and identity separation.
- `scripts/staging-degraded-fallback.mjs` requires explicit 503 with fallback off and explicit `degraded=true`, `stale=true` with fallback on.
- `scripts/staging-lifecycle-evidence.mjs` exports Release A/B identities, 36 poster hashes, source counts, the final pointer, and ordered activation/rollback events.

The controlled OpenAI-compatible provider route exists only when both `RELEASE_ENVIRONMENT=staging` and `STAGING_FAULT_PROVIDER_ENABLED=true` are set and the protected bearer token matches. It is used solely to inject negative transport and result faults. Normal Release A/B generation and the first cross-instance replay request use the real, version-locked external model.

## Environment status

| Resource | Status | Evidence |
| --- | --- | --- |
| Supabase staging project | Created; migrations applied | New project ref above; remote DB lint completed |
| Persistent replay store | Verified remotely | First reservation `true`; repeated nonce `false` |
| Reviewer Vercel project | Created; not yet live-verified | Dedicated project, no custom domain |
| Web Vercel project | Created; not yet live-verified | Dedicated project, no custom domain or cron |
| Version-locked model | Selected, credential pending | `gpt-4o-2024-11-20` (text + image snapshot) |
| Direct COS Origin | Approved and verified in WP2 | Protected run `29721577122` |
| Normal A/B lifecycle | Pending | Requires live Reviewer credential and deployment |
| Fault matrix and rollback | Code and local gates complete; live run pending | Protected workflow only |

## Required completion evidence

- `environment-versions.md` with deployment SHA, migration SHA, and model/ruleset versions.
- `staging-verification.sanitized.json` from the protected workflow.
- Release A/B IDs, content/release hashes, 18-object manifests, pointer queries, audit events, fault results, rollback, and reactivation.
- Reviewer timeout/shutdown, source correction/retraction and SSRF, lease conflict, COS tamper, Supabase 503/degraded behavior.

The work package and PR remain Draft until every pending item above is machine-verified. Production Release V2 remains disabled.
