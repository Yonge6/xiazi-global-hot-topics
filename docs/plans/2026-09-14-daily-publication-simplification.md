# Daily publication simplification

Status: implementation in progress; authorized by owner on 2026-09-14.

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
