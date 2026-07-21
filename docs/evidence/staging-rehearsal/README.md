# Release V2 staging rehearsal evidence

This directory contains only sanitized, machine-verifiable evidence for the isolated Release V2 staging environment. It never contains credentials, reusable signed URLs, production identifiers, or historical publication changes.

## Formal status

```json
{
  "realReviewerStatus": "not-executed",
  "protectedReviewerRehearsal": "waived",
  "workPackageThree": "accepted-with-reviewer-waiver",
  "productionEnablement": "authorized"
}
```

`STAGING_OPENAI_API_KEY` was not provided. No production key, mock response, fixed JSON, local provider, or controlled fault provider is accepted as evidence of a real staging Reviewer. The project owner subsequently waived that Reviewer requirement under `owner-risk-acceptance-2026-07`; the evidence remains `not-executed`, never `passed`.

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
- `scripts/staging-reviewer-faults.mjs` is implemented to verify authentication failure, provider 401/429/500, malformed output, timeout, outage, and cross-instance nonce replay while checking the active pointer before and after every scenario. It has not been accepted as live evidence without a real staging Reviewer.
- `scripts/staging-source-faults.ts` exercises unsupported and uncertain claims, correction and retraction markers, private redirects, redirect loops, mixed public/private DNS, and streaming body limits.
- `scripts/staging-visual-faults.ts` is implemented to use uploaded poster bytes with a staging-only controlled negative provider for negative IP, 153-comparison, bilingual-theme, and near-duplicate cases. The controlled provider is never used for Release A or B and has not been run or counted as real Reviewer evidence in this conditional state.
- `scripts/staging-database-faults.mjs` covers 05:50/06:00 lease contention, idempotent retry, owner isolation, heartbeat, expiry/takeover, old-worker rejection, transactional staging failure, activation failure, authorization failure, and client disconnect.
- `scripts/staging-storage-faults.ts` plus the protected COS verifier cover missing objects, incomplete manifests, manifest hash changes, overwrite, delete, copy, multipart, policy mutation, encryption, and identity separation.
- `scripts/staging-degraded-fallback.mjs` requires explicit 503 with fallback off and explicit `degraded=true`, `stale=true` with fallback on.
- `scripts/staging-lifecycle-evidence.mjs` exports Release A/B identities, 36 poster hashes, source counts, the final pointer, and ordered activation/rollback events.

The controlled OpenAI-compatible provider route exists only when both `RELEASE_ENVIRONMENT=staging` and `STAGING_FAULT_PROVIDER_ENABLED=true` are set and the protected bearer token matches. It is code for later negative fault injection only; it is not a real Reviewer and is not evidence of one. Normal Release A/B generation and the first cross-instance replay request require the real, version-locked external model.

## Environment status

| Resource | Status | Evidence |
| --- | --- | --- |
| Supabase staging project | Created; migrations applied | New project ref above; remote DB lint completed |
| Persistent replay store | Verified remotely | First reservation `true`; repeated nonce `false` |
| Reviewer Vercel project | Created; deployment not executed | Dedicated project, no custom domain; `realReviewerStatus: not-executed` |
| Web Vercel project | Created; live rehearsal deployment not executed | Dedicated project, no custom domain or cron |
| Version-locked model | Configuration selected; no real call executed | `gpt-4o-2024-11-20` (text + image snapshot) |
| Direct COS Origin | Approved and verified in WP2 | Protected run `29721577122` |
| Normal A/B lifecycle | Not executed | Requires live Reviewer credential and protected deployment |
| Fault matrix and rollback | Implemented; not executed as staging evidence | Requires successful normal A/B path first |
| Protected staging rehearsal | Blocked | `STAGING_OPENAI_API_KEY` intentionally absent |

## Non-credential verification

The evidence update was locally revalidated with 8 staging guard tests, 25 Reviewer tests, 137 Web tests, 21 browser E2E tests, and successful Reviewer/Web builds. Seven browser cases that require a deployed staging URL were skipped and remain part of the blocked protected rehearsal. Ordinary remote CI run `29734829434` independently passed the application/guard and real database lifecycle jobs; its protected job was skipped on the pull-request event by design.

## Required completion evidence

- `environment-versions.md` with deployment SHA, migration SHA, and model/ruleset versions.
- `staging-verification.sanitized.json` from the protected workflow.
- Release A/B IDs, content/release hashes, 18-object manifests, pointer queries, audit events, fault results, rollback, and reactivation.
- Reviewer timeout/shutdown, source correction/retraction and SSRF, lease conflict, COS tamper, Supabase 503/degraded behavior.

The original work-package result was **conditional pass**. It is now **accepted with a Reviewer waiver** for production rollout. This changes the decision gate, not the historical evidence: live Reviewer, normal staging A/B and the full live fault matrix remain unexecuted. Production rollout results must be recorded separately.
