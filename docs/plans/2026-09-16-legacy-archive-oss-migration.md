# Legacy archive migration to Alibaba OSS

## Goal

Move every pre-OSS Xiazi poster archive to the existing immutable Alibaba OSS
bucket without breaking current or historical editions. Git remains the source
of JSON manifests only; poster bytes are served from OSS.

## Design

1. Inventory every `data/archive/YYYY-MM-DD.json` without an OSS-backed
   `data/release-archive/YYYY-MM-DD.json`.
2. Resolve each issue's 18 poster files from the legacy Git tree using the
   canonical poster-name mapping. Abort before uploading if any date is
   incomplete.
3. Upload one date at a time to the existing `release-assets/` prefix with
   conditional creation, AES256 encryption, SHA-256 metadata, and full
   read-back verification.
4. After all 18 objects for a date verify, write three JSON records:
   the synchronized dated issue, its dated release manifest, and the immutable
   release bundle. Interrupted runs are idempotent and resume by date.
5. Make the poster route prefer a dated manifest for every archive date. When
   no manifest exists, retain the existing GitHub/Release V2 fallback.
6. Commit and publish JSON plus code only. Do not add poster binaries.

## Acceptance

- Every source-complete archive date has 9 topics and 18 OSS poster objects.
- Every object returns `image/png` and matches its manifest SHA-256.
- `/api/archive/` still lists every date.
- Current and archive routes pass `current=18/18 archive=18/18`.
- A pre-migration date redirects to Alibaba OSS rather than jsDelivr/COS.
- The legacy dirty checkout keeps the same HEAD and status fingerprint.

## Historical source gaps

The migration reports and leaves the existing fallback in place for dates that
never had a complete bilingual poster set in Git. As of 2026-09-16 these are:

- `2026-06-23`: nine Chinese posters exist; all nine English originals are absent.
- `2026-07-25` through `2026-07-28`: no dated poster files exist in Git history.

Do not duplicate Chinese art into English slots or generate replacement history.

## Local storage follow-up

After production acceptance, use the repository's partial-clone promisor
remote to evict historical poster blobs from the local object database. Do not
rewrite GitHub history while the legacy checkout contains uncommitted work.
