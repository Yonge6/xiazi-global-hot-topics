# Release V2 production deployment record

Status: Release V2 active under the recorded owner waiver; first monitored automatic release completed.

This record contains only live, sanitized evidence. A phase not re-exported by the monitored run remains explicitly unclaimed.

## Immutable baseline

- Closed-mode deployment run: `29804141832` (`SUCCESS`)
- Automatic-mode enablement run: `29814982527` (`SUCCESS`)
- Historical cutoff: `2026-07-18`; its 18 GitHub archive posters pass the remote archive verifier
- Historical content/assets changed by the monitored automatic run: `0` (the workflow accepts only the 2026-07-21 candidate and immutable COS batch)
- Production domain: `https://xiazishuo.com`
- Poster origin: Direct Tencent COS Origin; no CDN

## Phased deployment

| Phase | Required state | Result |
| --- | --- | --- |
| Closed code deployment | V2 off before controlled activation | `SUCCESS`, run `29804141832` |
| Waiver configuration | exact owner waiver fields; no fake Reviewer evidence | active response is `reviewStatus=waived`, `reviewPassed=false`, `reviewWaived=true` |
| Prior active release | complete immutable release before automatic run | Release B observed healthy immediately before the run |
| Manual A/B/rollback/reactivation | A -> B -> A -> B, one atomic pointer | not re-exported by this monitored-run evidence; no new pass claimed here |
| Production read | Release V2 active, explicit healthy/non-stale response | verified before and after the automatic run |
| First automatic release | approval automatic, monitored, rollback ready | `SUCCESS`, run `29837126146` in 7m07s |

## Live identities

- Release B observed before the automatic run: `rel_20260721_527fee52ed86d50c6f331661`
- First automatic Release C: `rel_20260721_c38c88c921e8b36a406479b5`
- Issue/content identity: `2026-07-21` / `ff18e6229ef027a57a4a96e79c68fc93a2915831e28b034e41eaf95ed69ef3bd` / `release-v2.1`
- Release C deployed at: `2026-07-21T14:08:29.704694+00:00`
- Asset batch: `asset_prod_20260721_auto_c_20260721t1652cst`
- Poster manifest SHA-256: `47e0c8b23f02d8a2639f104acc0a842e442987ac4f3d809514587e206c89f3d2`
- COS upload result: 18 posters; 15 immutable objects reused after hash verification, 3 missing objects created
- API/page/archive/poster consistency: live verifier `6/6 PASS`
- Remote COS archive: 18 posters with route release ID and SHA-256 proof, `PASS`
- Public `pluto.hk` references in API, `/zh/`, and `/en/`: `0`
- Sanitized workflow artifact: `production-stage-release-b-29837126146`
- Rollout URL: `https://github.com/Yonge6/xiazi-global-hot-topics/actions/runs/29837126146`

## Poster archive and local retention

- Legacy issues through 2026-07-18 use the GitHub archive as the canonical poster source.
- Release V2 issues after the cutoff use immutable Tencent COS objects as the canonical poster source.
- Live and historical verification checks GitHub/COS bytes and hashes; old local poster copies are not a release requirement.
- Local sparse checkout retains the three newest root archives, current mutable posters only, and excludes `apps/web/public/archive`.
- The successful automatic workflow applies local poster retention after staging/activation completes.
- Three clean worktrees were reduced from about 13 GB to about 4.4 GB (about 8.6 GB reclaimed).
- The primary dirty worktree was intentionally not cleaned. Its shared Git object store remains about 10 GB because committed binary history is still retained; reducing it requires a separately approved shallow reclone or history migration.

## Follow-up verifier correction

The first post-release live run exposed an assertion bug: the archive issue correctly used Release C but did not repeat current-only runtime fields. PR #27 now compares canonical issue content separately from the immutable release proof and requires archive `assetVersion` to equal the active `releaseId`. Application and database CI both passed, and the live verifier then passed `6/6`.

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

No deployment step may modify content or assets dated 2026-07-18 or earlier, use `pluto.hk`, reuse a VileSaint bucket, enable COS versioning, introduce a CDN, overwrite an existing release asset, or silently degrade. This rollout stayed within those boundaries.
