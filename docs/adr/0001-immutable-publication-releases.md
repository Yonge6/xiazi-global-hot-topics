# ADR-0001: Use immutable Supabase releases with an atomic active pointer

## Status

Accepted for future issues after 2026-07-18. Historical issues are explicitly out of scope.

## Context

The existing publisher writes archive and current JSON through separate GitHub Contents API calls and then mirrors the result to Supabase. A partial GitHub write, a failed deployment, or overlapping 05:50/06:00 jobs can expose a mixed release. Production also silently falls back from GitHub to packaged JSON, so a 200 response does not prove that the current issue is fresh.

The remediation must:

- keep 2026-07-18 content and assets unchanged;
- allow generation and validation to continue before human approval;
- expose either the complete old release or the complete new release;
- fail closed when source semantics or poster vision review are unavailable;
- make retries idempotent and rollback auditable;
- avoid a from-scratch rewrite during the existing GitHub-to-Supabase migration.

## Decision

Supabase becomes the activation authority for future issues.

1. A producer computes a stable content hash and deterministic release ID.
2. Posters are uploaded to immutable `releases/{releaseId}/...` paths.
3. The server re-fetches sources, stores snapshots and hashes, and runs semantic correction/retraction review.
4. The server validates all 18 posters with deterministic image checks and a fail-closed OCR/vision reviewer.
5. A validated candidate is inserted as an immutable `ready_for_approval` release.
6. A human Studio action calls one database RPC that records approval and atomically changes the `current` channel pointer.
7. Production reads only the pointed release when Release V2 is enabled.
   Content and poster requests carry the same `releaseId`; poster delivery resolves only the verified manifest for that immutable release.
8. If the release store is unavailable, any legacy response is explicitly marked `degraded` and `stale`; it is never a silent fallback.
9. GitHub JSON becomes an asynchronous audit export and disaster-recovery artifact, not the activation transaction.

The database owns publication leases, release immutability, activation idempotency, pointer serialization and rollback history. External source and vision reviewers run before the short activation transaction.

## Consequences

### Positive

- Activation is a single ACID transaction.
- The public pointer never references a partially validated release.
- Concurrent automation is serialized by an expiring database lease.
- Every response can identify its release, content hash, source and deployment time.
- Corrections and rollbacks create audit events instead of rewriting evidence.
- Missing semantic/OCR infrastructure blocks staging instead of weakening the gate.

### Negative

- Supabase becomes required for Release V2 activation and reads.
- A source semantic reviewer and poster vision reviewer must be provisioned before the feature flag can be enabled.
- Existing poster upload UI cannot be used as the future automation path because it writes mutable current assets.
- GitHub export becomes eventually consistent and needs separate monitoring.

### Neutral

- Legacy publication remains available behind a feature flag during migration, but cannot publish issues on or before the historical cutoff through Release V2.
- Multiple immutable candidates for a date are allowed, but only one release can be active on the `current` channel.

## Alternatives Considered

### One atomic Git commit plus a pointer file

This removes multi-PUT inconsistency but still couples activation to deployment timing and requires a second authoritative pointer store. It remains a viable disaster-recovery format, not the primary activation mechanism.

### Keep GitHub primary and make Supabase a stronger shadow

Rejected because shadow success cannot make several independent GitHub writes atomic, and production freshness remains hard to prove.

### Directly overwrite the existing `issues` rows

Rejected because it destroys release immutability and makes rollback and correction history ambiguous.

## Failure Modes

| Failure | Required behavior |
|---|---|
| Source or vision reviewer unavailable | Staging fails; active pointer is unchanged |
| Duplicate 05:50/06:00 job | Lease or idempotency key returns the existing result |
| Candidate validation fails | Release is not ready for approval; active pointer is unchanged |
| Approval request repeats | Activation key returns the already activated release |
| Supabase read fails | API returns 503, or an explicitly `degraded` and `stale` legacy response when emergency fallback is enabled |
| GitHub audit export fails | Active release stays online; export failure is recorded and retried |
| Bad release activated despite gates | Rollback RPC atomically points to a previously active immutable release |

## References

- `docs/release-safety-remediation.md`
- `supabase/migrations/20260718230000_future_release_safety.sql`
- `docs/MASTER-PRD-v3.1.md`
