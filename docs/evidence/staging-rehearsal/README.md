# Release V2 staging rehearsal evidence

Status: **not yet executed**.

This directory will contain only sanitized evidence from independent staging resources. It will not contain secrets, complete account IDs, production resource identifiers or reusable signed URLs.

Required evidence:

- environment and Git/migration/reviewer/storage versions;
- Release A and B identifiers, content/release hashes and 18-poster manifests;
- API, page, poster-route, Studio and database-pointer consistency;
- reviewer, source, lease/concurrency, storage and Supabase fault results;
- explicit 503 and degraded/stale behavior;
- A → B → rollback A → reactivate B audit sequence;
- CI links and unresolved risks.

Approved asset delivery scope: Direct COS Origin. CDN fields must be recorded as `not-applicable-for-direct-cos-origin` and `null` respectively.
