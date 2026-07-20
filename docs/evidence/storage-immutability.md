# Storage immutability evidence

## Scope and decision

This work applies only to future issues after `2026-07-18`. Historical content, posters, archive and Story Pool records are unchanged. Production Supabase, Vercel, DNS, CDN, COS and `RELEASE_V2_ENABLED` were not touched.

- Draft PR: https://github.com/Yonge6/xiazi-global-hot-topics/pull/13
- Base: `codex/release-review-services`
- Successful implementation head: `e004f7749cb4f9f19277faf77b3c9290f48ea03c`
- Successful protected run: https://github.com/Yonge6/xiazi-global-hot-topics/actions/runs/29721577122
- Policy version: `xiazi-cos-immutable-v3`
- Policy SHA-256: `5c518a862d9b65023b2ed4821d1a11f21931d765e87ad2b04a6a7719acec1e1f`

The dedicated Tencent COS staging controls passed. Release V2's approved first-stage topology is **Direct COS Origin**, with no CDN and no staging domain. Source/CDN comparison is therefore recorded as `not-applicable-for-direct-cos-origin`, not as a skipped or failed gate. Work package two is **passed within the Direct COS Origin scope**, and work package three may start.

## Dedicated staging resources

- Provider: Tencent Cloud Object Storage (COS)
- Bucket evidence identifier: `xiazi-release-v2-staging-20260719-…`
- Region: `ap-guangzhou`
- Access: private read/write
- Default encryption: SSE-COS `AES256`
- Versioning: disabled and never enabled; proof described below
- Lifecycle rules affecting `release-assets/`: none
- Object Lock/WORM: not enabled
- GitHub Environment: `release-v2-storage-staging`, protected by manual approval
- Runtime identities: uploader, auditor and reader are separate
- Test-only identity: multipart fixture, limited to initiate/upload-part/abort under the verification prefix and unable to complete
- Approved delivery origin: Direct COS Origin
- CDN: not provisioned and not part of the approved scope; no production DNS or CDN was changed

The legacy VileSaint example and all production buckets were excluded.

## Provider protocol

Immutable paths use:

```text
release-assets/{assetBatchId}/{locale}/{slot}.png
```

Creation requires HTTPS and `x-cos-forbid-overwrite:true`. COS returned `409 FileAlreadyExists` for both same-content and different-content writes to an existing key. The application rereads metadata and bytes and verifies SHA-256, size, content type, ETag, object encryption and the immutable path.

The runtime credential can create under `release-assets/` and GET/HEAD for verification. It cannot delete, replace metadata, copy over an existing key, initiate or complete multipart upload, mutate bucket policy, change versioning, change encryption or enable Object Lock. The reader and auditor also fail closed on writes, deletes and policy mutation.

## Versioning-never-enabled proof

`x-cos-forbid-overwrite:true` is not treated as a safety boundary if bucket versioning has ever been enabled or suspended. The following evidence establishes the history for this new staging bucket:

1. CloudAudit records successful `PutBucket` creation by the root administrator at `2026-07-19 23:55:05 +08:00`, region `ap-guangzhou`, with no CAM error.
2. A CloudAudit query covering bucket creation through the successful verification returned exactly one `PutBucketVersioning` event.
3. That event occurred at `2026-07-20 14:25:45 +08:00`, was performed by the staging uploader during the negative test and failed with CAM error `11008` (`not authorized`).
4. The auditor's live `GetBucketVersioning` response contained neither `Enabled` nor `Suspended`; the protected verifier rejects either state.
5. No successful `PutBucketVersioning` event exists between creation and verification.

The sanitized event export is in `docs/evidence/storage/cloud-audit.sanitized.json`.

## Protected cloud verification

Run `29721577122` checked out `e004f7749cb4f9f19277faf77b3c9290f48ea03c` and completed all three jobs:

| Job | Result | Duration |
|---|---|---:|
| Storage protocol and policy | SUCCESS | 1m31s |
| Protected Tencent COS staging verification | SUCCESS | 1m36s |
| Release storage fail-closed integration | SUCCESS | 3m01s |

The cloud verifier produced an immutable retained proof object with:

- content SHA-256 `bec5b991d8bacf1fd93a1702ac39dc90157e574e800995d4308acfec578cb5db`;
- ETag `68c085f81f474ee78d628bbbdc94298f`;
- 88 bytes, `image/png`;
- object response encryption `AES256`;
- no provider version ID, consistent with never-enabled versioning;
- source readback SHA-256 equal to the uploaded content hash.

The provider returned:

- `409` for same-key/same-content and same-key/different-content replacement attempts;
- `403` for object and version deletion;
- `403` for metadata replacement and copy overwrite;
- `403` for uploader multipart initiate/upload-part and for a real upload-ID-based complete attempt;
- `403` for policy, versioning, encryption and Object Lock mutation;
- `403` for reader and auditor write/delete/policy mutation attempts.

The multipart complete result is based on a real upload ID and real part ETag. A fixture identity created the incomplete multipart session but could not complete it; the application attempted completion and was denied; the fixture then aborted the incomplete session. The existing baseline object remained byte-for-byte unchanged.

Machine output is in `docs/evidence/storage/staging-verification.sanitized.json`.

## Local verification

After correcting the negative `PutBucketPolicy` test to send the current valid policy rather than malformed `{}` JSON:

| Gate | Result |
|---|---|
| `npm run audit:storage-policy` | passed, policy v3 |
| `npm run check -w @xiazi/domain` | 5 files, 19 tests passed |
| `npm run check -w @xiazi/web` | 29 files, 123 tests passed |

The earlier protected run `29721333624` was rejected because a malformed policy body returned `400`; it was not accepted as denial proof. Commit `e004f77` changed all policy-mutation checks to send a valid, currently applied policy. The final provider result was `403`, which proves authorization denial rather than input rejection.

## Identity and policy evidence

- Sanitized CAM/effective identity grants: `docs/evidence/storage/cam-policies.sanitized.json`
- Sanitized applied bucket policy: `docs/evidence/storage/bucket-policy.sanitized.json`
- Break-glass process: `docs/evidence/storage/break-glass.md`
- Sanitized CloudAudit export: `docs/evidence/storage/cloud-audit.sanitized.json`

Secrets, complete Secret IDs, account IDs, reusable signed URLs and production identifiers are intentionally excluded.

## Approved origin scope and future CDN gate

The successful protected run predated the formal completion-gate wording and emitted `not-executed`. The audit owner subsequently approved Direct COS Origin as the Release V2 first-stage topology. The authoritative evidence status is now:

```json
{
  "cdnVerificationStatus": "not-applicable-for-direct-cos-origin",
  "cdnSourceHashMatches": null
}
```

Therefore:

- COS service-side immutability controls: passed;
- versioning history, encryption, identity separation and CloudAudit: passed;
- Source/CDN SHA-256 equality: not applicable to Direct COS Origin;
- work package two: **passed for Direct COS Origin**;
- work package three: **allowed to start in isolated staging**;
- production environment touched: **No**.

Any future CDN introduction is a separate architecture and acceptance change. Before a CDN may serve Release V2, its independent gate must verify source/CDN byte hashes, cache invalidation, private-origin authentication and error fallback. Until that gate passes, Direct COS Origin is the only approved delivery path.

PR #13 must remain Draft. Do not merge, enable production Release V2, create production credentials, change production DNS/CDN or reuse this staging proof as production authorization.
