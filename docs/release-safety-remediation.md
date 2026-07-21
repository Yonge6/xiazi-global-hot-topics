# Future publication safety remediation

## Scope

This change applies only to issues after `2026-07-18`. It does not edit, retract, regenerate, archive, redistribute or republish the 2026-07-18 issue.

## Audit status

The audit remains **D / failed**. This PR is intentionally a draft: it adds the future hard gates but does not enable them in production. Unattended publishing must remain disabled until the staging migration, reviewer services, storage policy and fault/rollback rehearsal are complete.

Work Package 3 is currently **conditional pass**. Its ordinary application/database CI, isolated Supabase migrations, persistent replay store, and staging guards are verified. Because no `STAGING_OPENAI_API_KEY` was provided, the real Reviewer and protected staging rehearsal were not executed:

```json
{
  "realReviewerStatus": "not-executed",
  "protectedStagingRehearsal": "blocked",
  "workPackageThree": "conditional-pass",
  "productionEnablementReview": "failed"
}
```

Mock output, fixed JSON, local simulation, and the staging-only negative fault provider are not substitutes for a real Reviewer and are not counted as protected staging evidence.

## Architecture change

```text
automatic generation
  -> compute contentHash and an immutable assetBatchId
  -> upload 18 posters to release-assets/{assetBatchId}/... through the approved Direct COS Origin path
  -> acquire expiring publication lease
  -> renew the owner-bound lease while gates run
  -> re-fetch and snapshot every real source
  -> review headline + intro claims in both languages and check corrections/retractions
  -> deterministic image + OCR/vision/IP + 18-poster perceptual/semantic comparison
  -> compute sourceSnapshotHash + posterManifestHash (including immutable object identities and storage policy version)
  -> releaseHash = SHA256(schemaVersion + contentHash + sourceSnapshotHash + posterManifestHash)
  -> compute releaseId from issueDate + releaseHash
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
| Identity | Date, mutable current JSON | `releaseId` binds schema, copy, source snapshots and the full poster manifest |
| Atomicity | Multiple GitHub PUTs | One `activate_publication_release` transaction |
| Concurrency | Prompt/local lock | Owner-bound expiring database lease, heartbeat and retry short-circuit |
| Sources | URL availability; batch parser could replace URL | Real URL, pinned public DNS/IP, manual redirects, bounded stream, snapshot/hash/fetch time and four-claim review |
| Posters | Decode/size/basic parity | 18 exact slots, PNG/ratio/hash, OCR, language, number, title, date, site, theme, IP, perceptual hash and all-pairs semantic checks |
| Production proof | Issue body only | `releaseId`, `contentHash`, `dataSource`, `deployedAt`, health and stale flags |
| Fallback | Silent packaged/local JSON | Explicit 503 or visibly degraded/stale emergency fallback |
| Rollback | Rewrite many files | Atomic pointer change to a prior immutable release |

## Migration plan

1. Merge code and migration without enabling `RELEASE_V2_ENABLED`.
2. Apply `20260718230000_future_release_safety.sql` and `20260719010000_release_safety_hardening.sql` to staging Supabase.
3. Configure server-only `SOURCE_SEMANTIC_REVIEW_URL`, `POSTER_VISION_REVIEW_URL`, `RELEASE_REVIEW_BEARER_SECRET` and `RELEASE_REVIEW_SIGNING_SECRET`.
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
| `RELEASE_REVIEW_BEARER_SECRET` | Bearer credential for both review services | Missing blocks staging |
| `RELEASE_REVIEW_SIGNING_SECRET` | HMAC key binding timestamp, nonce, path and raw body | Missing blocks staging |
| `RELEASE_REVIEW_TIMEOUT_MS` | Reviewer client hard timeout | Timeout blocks staging |
| `RELEASE_STAGE_SECRET` | Optional dedicated automation stage secret; falls back to `CRON_SECRET` | Missing both rejects staging |

## Operational gates before unattended publishing

- A staged release cannot activate without `validation_report.passed=true`.
- A Studio session and same-origin request are required for approval and rollback.
- A release dated on or before 2026-07-18 is rejected by application and database constraints.
- A reviewer timeout or malformed response fails closed.
- A source is fetched only after every redirect hop and its resolved IPv4/IPv6 addresses pass the public-network policy; the connection is pinned to the checked address and the body is stream-limited.
- Every topic must return `supported` for `headlineFact` and `intro` in both `zh-CN` and `en-US`.
- The poster batch must contain 18 image reviews and all 153 pair comparisons. Cross-language pairs must share a theme; distinct topics above the similarity threshold require rejection or human review.
- Staging requires the live lease owner and a non-expired lease. An active idempotent retry returns the existing job/release without rerunning source and poster gates.
- Reusing an existing `releaseId` with any payload, source, poster or validation difference raises `RELEASE_PAYLOAD_CONFLICT`.
- The API never labels a legacy response healthy when Release V2 is enabled.
- Rollback requires a reason and records the previous and target release IDs.
- Repeated activation and rollback requests report both the requested release and the actual current active pointer; they never claim a rolled-back release is active.

## Approved asset origin

Release V2 staging and its initial approved production design use **Direct COS Origin**. No CDN or staging domain is part of this scope. Storage evidence records:

```json
{
  "cdnVerificationStatus": "not-applicable-for-direct-cos-origin",
  "cdnSourceHashMatches": null
}
```

The Tencent COS service-side immutability work package is passed for this topology: conditional create, overwrite/delete/copy/multipart denial, separated identities, AES256 and versioning history were verified in protected run `29721577122`.

Adding any CDN is a future independent change gate. It must prove origin/CDN SHA-256 equality, cache refresh behavior, private-origin authentication and error fallback before CDN URLs can enter a Release manifest or public read path.

## Remaining risks

- The external semantic and vision reviewer implementation, versioned protocol, HMAC/replay controls and fail-closed client are provided by the stacked reviewer-services PR. The durable replay store is verified in isolated staging Supabase, but a real Reviewer deployment, staging-only model credential, pinned-model calls and monitoring export remain required before production enablement.
- Tencent COS immutability is verified and passed for the approved Direct COS Origin topology. CDN delivery remains outside the approved scope and requires its own future acceptance gate.
- GitHub audit export is intentionally outside the activation transaction and needs a retry worker.
- Existing mutable Studio poster upload remains a legacy-only path and must stay disabled for future Release V2 automation.
- Studio currently records a configured approver label for the shared session; individual user identity and stronger session controls remain a separate authentication hardening task.
- Downstream channel delivery receipts are audited separately and are not part of the database pointer transaction.
- Full production validation requires staging/production credentials and cannot be proven by repository unit tests alone.

## Work Package 3 conditional evidence

- Implementation head: `2690ebb872556d92d534b3c3b31c7024e53d421f`.
- Ordinary CI run: `29734829434`; application/guard and database lifecycle jobs succeeded.
- Protected live staging proof: skipped on the pull-request event and intentionally not dispatched without a staging-only model credential.
- Real Release A/B publication, full fault injection, rollback, and reactivation: not executed.
- Production resources: untouched; production `RELEASE_V2_ENABLED` remains off and unattended publishing remains paused.

The exact machine-readable status is stored in `docs/evidence/staging-rehearsal/status.sanitized.json`.

## Verification evidence

Executed in the isolated `codex/future-release-safety` worktree on 2026-07-19. Counts below are refreshed after the final full verification run:

| Check | Result |
|---|---|
| `npm run check` | Passed: lint, TypeScript, config audit and all package tests |
| `npm run test` | Passed: web 91, domain 6, contracts 3 tests (100 total) |
| `npm run build` | Passed; one pre-existing Turbopack NFT trace warning remains |
| `npm run test:e2e` | Passed: 21 tests, 7 staging-only tests skipped because no staging URL was supplied |
| `npx supabase db reset` | Passed: clean database recreated with every migration |
| `npx supabase db lint --local --level warning` | New migration clean; three warnings remain in pre-existing `upsert_issue_bundle` |
| `scripts/verify-future-release-rpcs.sql` | Passed in real local Postgres and rolled back its fixtures |
| `.github/workflows/release-safety-ci.yml` | Runs the application gates and real Supabase fault suite on every PR; remote run must be green before Draft can advance |

## Fault injection and rollback verification

The SQL fault suite verifies the 2026-07-18 cutoff, active retry short-circuit, owner preservation, heartbeat renewal, expired-worker rejection, takeover rejection of the old owner, full-payload conflict detection, same-copy/different-asset release identities, staging without activation, explicit human activation, truthful activation/rollback retries, atomic pointer changes, immutable release payloads, auditable events and rollback to the previous release.
