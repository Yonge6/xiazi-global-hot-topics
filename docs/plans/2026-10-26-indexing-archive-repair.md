# June 23 archive indexing repair

**Goal:** Restore the already-published 2026-06-23 edition without changing its editorial text or assets.

**Architecture:** Data-only compatibility repair in the canonical Git archive and public JSON mirror, followed by guarded replacement of the two existing production runtime copies. No app code rebuild, service restart, latest-issue publication or new posters.

**Tech stack:** Existing TypeScript/Zod contracts, Vitest, JSON and bounded SSH file staging.

## Verified root cause
`parseIssue` rejects `topics[0].category=overview` and `topics[0].sources[0].sourceType=original`. The runtime catches validation failure and returns null; `/en/?issue=2026-06-23` then returns 404. Git and both runtime JSON copies are identical (SHA-256 `37ba5ce4f3e0fd0e521f096b3f92dfd354c6728acfdebf24be818b2f4a1f0da5`).

## Implementation and acceptance
1. Regression test must first fail with both exact enum errors.
2. Normalize the overview to the established `international` category and the Xiazi Says source to `publisher`. Preserve localized category label `Overview` and all copy, dates, IDs and poster version.
3. Synchronize public JSON mirror, replacing its obsolete source-domain alias with the canonical record.
4. Run all contract tests; hash all data except the two repaired enum fields to prove editorial content unchanged.
5. Commit only the JSON files, regression test and this audit; push normal fast-forward main update. Stop if branch protection or non-fast-forward conflicts require review.
6. Pin the active runtime release, check both old hashes, save backups, replace JSON copies atomically and verify schema and public archive/API/date. Do not restart services or republish the current release.
7. Re-read current release identity and representative poster paths; record historical missing assets separately, never invent replacements.

## Related findings to preserve
- `climate-adaptation-city` is already the identifier in the historical source for the AI regulation article. There is no evidence of a new router misassociation; renaming would break historical links and poster mapping. Preserve the stable ID.
- Existing migration notes record nine missing English originals for June 23. Restoring JSON compatibility is not evidence those images are recovered. Preserve the known gap and do not generate replacement history.
- WonderElian's Graphic Brutalism article was deliberately removed September 21; keep its 404.

## Audit
- actor: Codex
- source: authenticated production source/schema and exact Git archive comparison
- action: reproduce archive failure, add regression coverage and normalize two invalid metadata values
- result: original test fails on the two documented values; after the patch all 10 contract tests pass and all other canonical archive fields retain their hash
- status: code_verified_pending_production
