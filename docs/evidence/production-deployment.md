# Release V2 production deployment record

Status: authorized, execution pending.

This record is completed only from live, sanitized evidence. Empty fields are not passes.

## Immutable baseline

- Pre-deployment main SHA: pending
- Production active issue before migration: pending
- Supabase backup identity/time: pending
- Migration list and SHA-256: pending
- Historical cutoff verification: pending
- Historical rows changed: must remain `0`

## Phased deployment

| Phase | Required state | Result |
| --- | --- | --- |
| Closed code deployment | V2 off, human approval, review enforced | pending |
| Waiver configuration | exact owner waiver fields; no fake Reviewer evidence | pending |
| Candidate A | V2 read off; 18 immutable COS objects and complete hashes | pending |
| Candidate B | V2 read off; second immutable identity | pending |
| Manual A/B/rollback/reactivation | A -> B -> A -> B, one atomic pointer | pending |
| Production read | V2 on, fallback off, human approval | pending |
| First automatic release | approval automatic, monitored, rollback ready | pending |

## Live identities

- Release A: pending
- Release B: pending
- First automatic release: pending
- API/page/poster release ID consistency: pending
- COS manifest/hash consistency: pending
- Activation and rollback event export: pending

## Monitoring checklist

- publication job failures
- lease conflicts, expiry and takeover
- active pointer mismatch
- API/page/poster release ID mismatch
- missing posters or changed COS hash
- 503, degraded or stale responses
- rollback events
- target-time publication miss
- missing waiver fields or unexpected switch to enforced mode

## Boundaries

No deployment step may modify content or assets dated 2026-07-18 or earlier, use `pluto.hk`, reuse a VileSaint bucket, enable COS versioning, introduce a CDN, overwrite an existing release asset, or silently degrade.
