# Release V2 isolated staging rehearsal plan

## Scope

This work package is stacked on `codex/release-storage-immutability` and applies only to future Release V2 candidates after `2026-07-18`. It must remain a Draft PR and must not modify production Supabase, Vercel, COS, DNS, historical content or `RELEASE_V2_ENABLED` in production.

The approved asset topology is **Direct COS Origin**. No CDN or test domain will be created or connected. Storage evidence uses:

```json
{
  "cdnVerificationStatus": "not-applicable-for-direct-cos-origin",
  "cdnSourceHashMatches": null
}
```

Any future CDN is a separate acceptance gate.

## Steps and verification

### Step 1: isolated staging inventory and guards

- Output: a machine-readable environment inventory and a staging-only command guard that rejects production-looking projects, domains, buckets and credentials.
- Test: commands fail before network mutation when `STAGING_ENV`, project names or resource identifiers are missing or production-like.

### Step 2: reviewer deployment

- Output: independent reviewer deployment with pinned protocol, ruleset, provider and model versions, HMAC/bearer authentication, persistent replay store, health/version endpoints, timeouts, concurrency limits and sanitized logs.
- Test: semantic four-claim and visual 18-poster/153-pair requests pass; missing, malformed, replayed, timed-out, unauthorized and incomplete responses fail closed.

### Step 3: staging Supabase and Web

- Output: independent Supabase project with both Release V2 migrations and independent Web deployment with Release V2 initially disabled.
- Test: no production project IDs, service roles, domains or deployment aliases are present; migration checks and release RPC invariants pass.

### Step 4: normal Release A and B lifecycle

- Output: two immutable future test candidates using the verified staging COS Direct Origin, real reviewer calls, 18 posters, source snapshots, human approval and atomic activation.
- Test: API, `/zh/`, `/en/`, all 18 poster routes, Studio, database current pointer and audit events expose one identical `releaseId` after each activation.

### Step 5: fault injection

- Output: machine-run scenarios for reviewer outage/timeout/auth/malformed results, correction/retraction, SSRF, response limits, lease concurrency/takeover, COS tamper/missing/duplicate assets and Supabase failure.
- Test: no failed scenario changes the current pointer; fallback-off returns 503; fallback-on is explicitly `degraded=true` and `stale=true`.

### Step 6: rollback rehearsal and evidence

- Output: Release A → Release B → rollback A → reactivate B with truthful idempotency responses and ordered audit events.
- Test: the actual current pointer matches every response; evidence files contain no secret, full account ID, service-role key or reusable signed URL.

## Completion gate

Work package three can be reported complete only when code, remote CI, real isolated staging deployments and every normal/fault/rollback scenario have machine-verifiable evidence. Completion does not authorize production enablement, merging or marking any stacked PR Ready.

## Current execution record

- Independent Supabase staging project created in Singapore and all migrations applied through `20260720010000_reviewer_replay_nonce_store.sql`.
- Remote schema lint completed; only pre-existing `upsert_issue_bundle` warnings remain.
- Remote replay reservation proved atomic (`true` then `false` for the same nonce hash).
- Dedicated Reviewer and Web Vercel projects created with no custom domains and no production resources.
- Live model requests, A/B releases, fault injection, rollback, and evidence export remain blocked on a staging-only OpenAI API credential.
- The protected workflow now includes deterministic negative fault transport, real multi-instance replay protection, source/visual/lease/COS/Supabase fault suites, explicit 503/degraded deployments, and sanitized lifecycle evidence export. The negative provider cannot run outside the staging environment and is never used for the normal A/B release path.
