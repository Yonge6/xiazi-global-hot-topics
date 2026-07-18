# Future publication safety remediation

## Scope

This change applies only to issues after `2026-07-18`. It does not edit, retract, regenerate, archive, redistribute or republish the 2026-07-18 issue.

## New publication flow

```text
automatic generation
  -> compute contentHash and releaseId
  -> upload 18 posters to immutable release paths
  -> acquire expiring publication lease
  -> re-fetch and snapshot every real source
  -> semantic correction/retraction review
  -> deterministic image + OCR/vision/IP/duplicate review
  -> stage immutable ready_for_approval release
  -> human Studio approval
  -> one transaction activates current pointer
  -> production API/page read the same releaseId
  -> asynchronous GitHub audit export
```

## Old versus new

| Concern | Previous flow | Future Release V2 flow |
|---|---|---|
| Human gate | Direct publish from Studio/automation | Staging never activates; Studio approval is mandatory |
| Identity | Date, mutable current JSON | Unique immutable `releaseId` plus `contentHash` |
| Atomicity | Multiple GitHub PUTs | One `activate_publication_release` transaction |
| Concurrency | Prompt/local lock | Database lease with expiry, owner and idempotency key |
| Sources | URL availability; batch parser could replace URL | Real URL, snapshot, hash, fetch time and semantic review required |
| Posters | Decode/size/basic parity | 18 exact slots, PNG/ratio/hash, OCR, language, number, title, date, site, theme, IP and duplicate checks |
| Production proof | Issue body only | `releaseId`, `contentHash`, `dataSource`, `deployedAt`, health and stale flags |
| Fallback | Silent packaged/local JSON | Explicit 503 or visibly degraded/stale emergency fallback |
| Rollback | Rewrite many files | Atomic pointer change to a prior immutable release |

## Migration plan

1. Merge code and migration without enabling `RELEASE_V2_ENABLED`.
2. Apply `20260718230000_future_release_safety.sql` to staging Supabase.
3. Configure server-only `SOURCE_SEMANTIC_REVIEW_URL`, `POSTER_VISION_REVIEW_URL` and `RELEASE_REVIEW_SECRET`.
4. Run source, poster, concurrency, activation and rollback tests against staging.
5. Generate the first future candidate through `/api/internal/releases/stage/`.
6. Confirm the candidate appears in Studio as `ready_for_approval`; verify that the current site still shows the old active issue.
7. While `RELEASE_V2_ENABLED` is still off, manually approve the candidate so the atomic pointer has a complete target without changing the legacy production read path.
8. In staging, set `RELEASE_V2_ENABLED=true` and `RELEASE_EXPLICIT_DEGRADED_FALLBACK=false`; verify API, `/zh/`, `/en/` and all poster routes use the same `releaseId`.
9. In production, repeat migration, staging and manual approval with the flag off; enable the production read flag only after staging fault-injection and rollback evidence is attached to the deployment record.
10. Keep GitHub export read-only and asynchronous until disaster-recovery restore has been rehearsed.

No migration statement updates existing issue, archive, Story Pool or poster rows. The `current` channel is created without an active pointer.
Historical archives through 2026-07-18 remain on the existing read-only JSON path; only future archive entries are read from immutable releases.

## Required configuration

| Variable | Purpose | Failure behavior |
|---|---|---|
| `RELEASE_V2_ENABLED` | Switch future production reads and publish route to Release V2 | Off keeps legacy behavior |
| `RELEASE_EXPLICIT_DEGRADED_FALLBACK` | Permit marked emergency legacy reads | Off returns 503 |
| `SOURCE_SEMANTIC_REVIEW_URL` | Server-side source claim/correction reviewer | Missing blocks staging |
| `POSTER_VISION_REVIEW_URL` | Server-side OCR, semantic and IP reviewer | Missing blocks staging |
| `RELEASE_REVIEW_SECRET` | Bearer secret for both review services | Missing blocks staging |
| `RELEASE_STAGE_SECRET` | Optional dedicated automation stage secret; falls back to `CRON_SECRET` | Missing both rejects staging |

## Operational gates before unattended publishing

- A staged release cannot activate without `validation_report.passed=true`.
- A Studio session and same-origin request are required for approval and rollback.
- A release dated on or before 2026-07-18 is rejected by application and database constraints.
- A reviewer timeout or malformed response fails closed.
- The API never labels a legacy response healthy when Release V2 is enabled.
- Rollback requires a reason and records the previous and target release IDs.

## Remaining risks

- The external semantic and vision reviewer services must be deployed, versioned and monitored separately.
- The immutable object prefix still needs a storage-side deny-overwrite policy; the application prevents mutable Studio writes but cannot stop out-of-band credential misuse.
- GitHub audit export is intentionally outside the activation transaction and needs a retry worker.
- Existing mutable Studio poster upload remains a legacy-only path and must stay disabled for future Release V2 automation.
- Studio currently records a configured approver label for the shared session; individual user identity and stronger session controls remain a separate authentication hardening task.
- Downstream channel delivery receipts are audited separately and are not part of the database pointer transaction.
- Full production validation requires staging/production credentials and cannot be proven by repository unit tests alone.

## Verification evidence

Executed in the isolated `codex/future-release-safety` worktree on 2026-07-18:

| Check | Result |
|---|---|
| `npm run check` | Passed: lint, TypeScript, config audit and all package tests |
| `npm run test` | Passed: web 77, domain 6, contracts 3 tests |
| `npm run build` | Passed; one pre-existing Turbopack NFT trace warning remains |
| `npm run test:e2e` | Passed: 21 tests, 7 staging-only tests skipped because no staging URL was supplied |
| `npx supabase db reset` | Passed: clean database recreated with every migration |
| `npx supabase db lint --local --level warning` | New migration clean; three warnings remain in pre-existing `upsert_issue_bundle` |
| `scripts/verify-future-release-rpcs.sql` | Passed in real local Postgres and rolled back its fixtures |

The SQL fault suite verifies the 2026-07-18 cutoff, conflicting lease rejection, staging without activation, explicit human activation, activation idempotency, atomic pointer changes, immutable release payloads, auditable events and rollback to the previous release.
