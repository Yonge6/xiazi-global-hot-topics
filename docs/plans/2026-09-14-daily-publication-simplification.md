# Daily publication simplification

Status: implemented and live-verified on 2026-09-14; authorized by owner.

## Outcome

One local command publishes nine bilingual stories and eighteen existing PNGs,
then verifies the public issue and archive. No local Git fetch, checkout, image
commit, mirror directories, database staging or application deployment per day.

## Tasks

1. Audit production reader, scripts, scheduler and storage; preserve dirty work.
2. Add a candidate-only builder and reuse the existing immutable COS uploader.
3. Change the manifest publisher to commit current issue, dated issue, current
   manifest, dated manifest and immutable release history atomically, JSON only.
4. Add content-addressed identities, complete slot/hash validation, concurrency
   conflict protection, idempotent retry, previous-release preservation and rollback.
5. Add a single entry point with preflight, upload, activation and live/archive
   acceptance. Persist reports and never mistake upload success for publication.
6. Test malformed/missing/duplicate images, incomplete manifest, conflicts,
   idempotence, rollback and archive preservation. Run check/build and live gates.
7. Publish scoped source changes without fetching binary history; migrate today's
   already uploaded release without regenerating images or disturbing the site.
8. Update the existing 04:00 automation, keeping editorial/image preferences.
9. Verify and recoverably remove only duplicate Git pack objects; preserve refs,
   worktrees, unique history and unrelated files.

## Acceptance

18/18 immutable object hashes, 18/18 current routes, 18/18 dated routes; current
issue assetVersion equals releaseId; both languages and archive entry work;
second run makes no commit and no new images; daily path never invokes Git.

## ADR: retain the current production reader contract

The Alibaba website already reads dated COS manifests. Keep those four JSON
paths and add immutable release history for same-day rollback. Use the current
COS conditional-create and hash-verification implementation, not a second storage
provider. Existing pre-COS historical images remain untouched.

Alternatives: Git LFS still requires history and a new storage integration;
rewriting Git history endangers rollback and other worktrees; database staging
adds a second activation system unused by the current JSON production reader.

Trade-off: GitHub and COS remain runtime dependencies. Failed verification does
not activate a candidate; non-fast-forward publication is rejected. Old history
is retained rather than promising a permanently fixed repository size.

## Verified outcome

- Current issue retained: `rel_20260914_c12dc16c785d5b3967582544`.
- Actual direct upload: 18 immutable objects reused, 0 created.
- Actual publish rerun: idempotent, 0 additional commits.
- Current and historic poster routes: 18/18 each, plus COS SHA-256 checks.
- Web `check`: 37 files / 175 tests passed; repository `check` passed.
- Local builds and Alibaba candidate build passed. Existing Next file-tracing
  warning remains non-fatal; no claim that all unrelated build warnings vanished.
- Alibaba reader deployment: `daily-direct-20260914-v1`, preserving the prior
  `editorial-icons-20260914-v1` UI and rollback directory.
- 04:00 automation now uses the single direct entry point, with its model and
  image-generation preferences preserved. Tomorrow's scheduled run is not yet observed.
- Legacy non-atomic publisher disabled, mirror tool maintenance-gated, obsolete
  Supabase shadow workflow no longer triggered by daily JSON changes.
- All five Git packs passed verify-pack before removal. The removed pack had
  1,454 objects, all duplicated in survivors, 0 unique objects. 17,680 distinct
  packed objects and all refs/worktrees retained. Original pack and sidecars
  SHA-256 copied to `/Volumes/LaCie/xiazi-git-duplicate-recovery-20260914`.
- Packed storage reduced from 7.13 GiB to 4.70 GiB. The daily entry point does not
  invoke local Git, so it cannot reintroduce the old daily fetch path. Other Git
  operations and legitimately new content can still grow the repository.
