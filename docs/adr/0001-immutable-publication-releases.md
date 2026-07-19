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

1. A producer computes a stable content hash and allocates an immutable `assetBatchId`.
2. Posters are created under `release-assets/{assetBatchId}/...` through a create-only storage identity and a provider-side atomic no-overwrite condition. The server rereads each object and binds its SHA-256, byte length, media type, ETag and immutable provider identity into the manifest; the final release ID is intentionally not known yet.
3. The server acquires an owner-bound expiring lease, renews it while validation runs, and short-circuits active retries with the same idempotency key.
4. The server re-fetches each source through manual redirects with public DNS/IP validation, a pinned connection and a streaming byte cap. It stores the snapshot/hash and reviews correction status plus headline and intro claims in both languages.
5. The server validates all 18 posters with deterministic image checks, perceptual hashes and a fail-closed batch OCR/vision reviewer that returns all 153 pair comparisons. It also requires a current storage-policy attestation proving overwrite and delete denial and rejects an incomplete, mutable or origin-mismatched object manifest.
6. The server computes `releaseHash = SHA256(schemaVersion + contentHash + sourceSnapshotHash + posterManifestHash)` and derives `releaseId` from the date and that complete identity.
7. A validated candidate is inserted as an immutable `ready_for_approval` release. Reusing an ID with any different payload raises `RELEASE_PAYLOAD_CONFLICT`.
8. A human Studio action calls one database RPC that records approval and atomically changes the `current` channel pointer.
9. Production reads only the pointed release when Release V2 is enabled.
   Content and poster requests carry the same `releaseId`; poster delivery resolves only the verified manifest for that immutable release.
10. If the release store is unavailable, any legacy response is explicitly marked `degraded` and `stale`; it is never a silent fallback.
11. GitHub JSON becomes an asynchronous audit export and disaster-recovery artifact, not the activation transaction.

The database owns publication leases, release immutability, activation idempotency, pointer serialization and rollback history. External source and vision reviewers run before the short activation transaction.

## Consequences

### Positive

- Activation is a single ACID transaction.
- The public pointer never references a partially validated release.
- Concurrent automation is serialized by an expiring database lease.
- Every response can identify its release, content hash, source and deployment time.
- Corrections and rollbacks create audit events instead of rewriting evidence.
- Missing semantic/OCR infrastructure blocks staging instead of weakening the gate.
- Missing storage-policy proof, conditional-create support or any object identity mismatch blocks staging before the release row is created.

### Negative

- Supabase becomes required for Release V2 activation and reads.
- A source semantic reviewer and poster vision reviewer must be provisioned before the feature flag can be enabled.
- Existing poster upload UI cannot be used as the future automation path because it writes mutable current assets.
- A dedicated immutable asset bucket and separated create-only/read/break-glass identities must be operated and audited.
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
| Duplicate 05:50/06:00 job | The live owner lease is preserved; same-key retry returns the existing job/release without rerunning gates |
| Worker lease expires during validation | Staging fails for that owner; a heartbeat or a fresh owner must hold the live lease |
| Source redirects to private/reserved infrastructure | Redirect is rejected before the next request; active pointer is unchanged |
| Same copy is paired with changed sources or posters | Complete release hash creates a different release ID; conflicting reuse fails closed |
| Storage policy is absent, stale or not server-enforced | Staging fails; the active pointer is unchanged |
| Existing asset key is reused with different bytes | Provider atomic create rejects the write; application reports a non-retryable content conflict |
| Stored bytes, metadata or provider identity change during verification | Manifest verification fails; no release is staged |
| Candidate validation fails | Release is not ready for approval; active pointer is unchanged |
| Approval or rollback request repeats | Response reports the requested release and actual current pointer without falsely claiming active status |
| Supabase read fails | API returns 503, or an explicitly `degraded` and `stale` legacy response when emergency fallback is enabled |
| GitHub audit export fails | Active release stays online; export failure is recorded and retried |
| Bad release activated despite gates | Rollback RPC atomically points to a previously active immutable release |

## References

- `docs/release-safety-remediation.md`
- `supabase/migrations/20260718230000_future_release_safety.sql`
- `supabase/migrations/20260719010000_release_safety_hardening.sql`
- `docs/MASTER-PRD-v3.1.md`
