# Storage immutability evidence

## Scope and status

This evidence applies only to future issues after `2026-07-18`. Historical content, posters, archive and Story Pool records are unchanged. Production Supabase, Vercel, DNS, COS buckets/policies/credentials and `RELEASE_V2_ENABLED` are untouched.

Current status: code implementation and local/remote verification are tracked in this Draft work package. Real Tencent COS staging policy verification is not complete and must not be represented as passed.

- Draft PR: https://github.com/Yonge6/xiazi-global-hot-topics/pull/13
- Base: `codex/release-review-services`
- Validated head: `9611bb95c23b3534953faf53f8abb0501806e3fb`

Code and ordinary remote CI success do **not** establish that Tencent COS enforces the proposed cloud policy. Real COS staging verification has not been executed. Work package three must not start while this provider-side evidence remains incomplete.

## Identified provider

Provider: **Tencent Cloud Object Storage (COS)**.

Repository evidence:

- `apps/web/src/lib/cos/storage.ts` implements Tencent COS REST signing and upload/copy operations.
- configuration names are `COS_SECRET_ID`, `COS_SECRET_KEY`, `COS_BUCKET`, `COS_REGION` and `NEXT_PUBLIC_COS_BASE_URL`.
- `DECISIONS.md` D-016 retains COS for binary assets.
- no alternative object-upload provider SDK exists in the application.

The checked-in legacy example references a VileSaint bucket and is forbidden for this Xiazi work package. Cloud verification requires a separate Xiazi staging bucket. No linked Vercel project or Vercel CLI was available in the isolated worktree, so deployed environment values were neither read nor inferred.

## Provider capability and policy version

Policy template version: `xiazi-cos-immutable-v2`.

Tencent COS provides an atomic no-overwrite request header, `x-cos-forbid-overwrite:true`, and returns `409 FileAlreadyExists` for an existing key. CAM condition `cos:x-cos-forbid-overwrite` can require this header. Official documentation also states that this header is ineffective if versioning has ever been enabled or suspended. The target must therefore be a dedicated bucket that has never enabled versioning, and this state must be verified in staging.

COS Object Lock/WORM is available only to allowlisted customers and cannot be safely or reversibly enabled from this PR. It remains an optional stronger control requiring separate approval.

Official references:

- https://cloud.tencent.com/document/product/436/7749
- https://intl.cloud.tencent.com/zh/document/product/436/46206
- https://cloud.tencent.com/document/product/436/55294
- https://cloud.tencent.com/document/product/436/19884
- https://cloud.tencent.com/document/product/436/40136
- https://cloud.tencent.com/document/product/436/40137

## Storage architecture

Immutable keys use:

```text
release-assets/{assetBatchId}/{locale}/{slot}.png
```

The application stores and verifies asset batch, topic, locale, SHA-256, content type, byte size, creation time, uploader version, ETag, `AES256` server-side-encryption evidence and a provider version identity or equivalent immutable proof. ETag is never treated as SHA-256.

The runtime interface exposes only create, HEAD and read. Creation uses the provider's atomic no-overwrite header, then rereads metadata and bytes to validate SHA-256, size and content type. Same-key/same-content retries are explicit idempotent results; same-key/different-content is a non-retryable conflict.

Release staging requires a complete 18-object manifest and a storage verification report with `overwriteDenied=true`, `deleteDenied=true` and `policyVerified=true`. Until a real staging policy is verified, `policyVerified=false` and staging fails closed.

## Credential separation

- Application uploader: create-only under the staging `release-assets/` prefix plus HEAD/GET verification. No delete, metadata replacement, copy overwrite, multipart completion, retention, bucket policy or versioning controls.
- Staging reader: read-only. The protected verifier uses a separate CAM identity to prove read success and write/delete/policy denial. No CDN service identity is included while CDN verification is explicitly deferred; any future CDN grant requires separate review. The staging reader has no write, delete or policy permissions.
- Break-glass administrator: excluded from runtime and ordinary CI; MFA/independent approval and cloud audit logging required.

## Machine-verifiable results

Local verification on 2026-07-19 (QClaw Node.js 22 runtime; no cloud credentials):

| Gate | Result |
|---|---|
| `npm run audit:storage-policy` | passed; `xiazi-cos-immutable-v2` template and deny set accepted |
| `npm run check` | passed; 20/20 Turbo tasks |
| Contracts | 2 files, 6 tests passed |
| Domain | 5 files, 19 tests passed, including 11 immutable-path/manifest tests |
| Reviewer inherited baseline | 2 files, 20 tests passed |
| Web | 29 files, 121 tests passed |
| Storage-focused rerun | 6 files, 27 tests passed |
| `npm run build` | passed; reviewer and web production builds succeeded |
| Playwright, one worker and unchanged assertions | 21 passed, 7 staging-only skipped |

The storage tests cover first create, same-content idempotency, different-content conflict, simultaneous same-key writers, unsupported conditional writes, post-upload SHA-256/size/metadata mismatch, strict immutable URL parsing, complete 18-object manifests, policy-attestation failure, source-object tampering, COS request headers and versioning fail-closed behavior.

These results prove the application protocol and local COS adapter behavior. They do **not** prove that a real Tencent account currently enforces the supplied CAM policy.

## Remote CI

Final GitHub Actions run: https://github.com/Yonge6/xiazi-global-hot-topics/actions/runs/29690056491

| Check | Conclusion | Duration |
|---|---|---|
| `Storage protocol and policy` | SUCCESS | 1m27s |
| `Release storage fail-closed integration` | SUCCESS | 3m06s |
| `Protected Tencent COS staging verification` | SKIPPED | protected manual-only job; no cloud credentials used |

This final run validates the head above. Any evidence-only follow-up commit must rerun the same PR checks; the PR check rollup is the final source of truth for the Draft head.

## Staging-only verifier

Implemented as `scripts/verify-storage-immutability.mjs`, but deliberately not executed against cloud resources. It requires `STORAGE_ENV=staging`, rejects production-looking bucket/prefix/CDN values, creates a random isolated proof key, never deletes that proof object, never prints credentials and exits nonzero on any failed invariant.

The protected workflow job is manual-only and uses the `release-v2-storage-staging` GitHub Environment. It requires separate application and audit identities. A run attempts all of the following and accepts only the documented denial response codes:

1. first create and source readback;
2. same-key same-content PUT denial plus idempotent read verification;
3. same-key different-content PUT denial;
4. object delete and version delete denial;
5. metadata-replacing self-copy denial;
6. copy-over-existing-key denial;
7. multipart complete denial;
8. bucket policy, versioning, Object Lock and default-encryption mutation denial by the application identity;
9. bucket default encryption and object response both prove `AES256`;
10. read-only and audit identities can read their required scope but cannot upload, delete or mutate policy;
11. source and CDN SHA-256 equality when `STORAGE_CDN_VERIFICATION=required`.

Authorized staging execution command:

```bash
STORAGE_ENV=staging \
STORAGE_CDN_VERIFICATION='skip' \
COS_BUCKET='<dedicated-xiazi-staging-bucket>' \
COS_REGION='<region>' \
STORAGE_APP_SECRET_ID='<create-only-identity>' \
STORAGE_APP_SECRET_KEY='<redacted>' \
STORAGE_AUDIT_SECRET_ID='<read-policy-identity>' \
STORAGE_AUDIT_SECRET_KEY='<redacted>' \
STORAGE_READER_SECRET_ID='<read-only-object-identity>' \
STORAGE_READER_SECRET_KEY='<redacted>' \
npm run storage:verify:staging
```

Credentials must be injected by the protected environment, never copied into a command transcript or evidence file. CDN equality may be skipped only by the explicit `STORAGE_CDN_VERIFICATION=skip` mode; machine output then records `cdnVerificationStatus=not-executed` and `cdnSourceHashMatches=null`, so the omission cannot be mistaken for a pass.

## Real cloud verification

Not executed. The following remain unchecked:

- dedicated staging COS bucket identity and versioning-never-enabled proof;
- bucket default SSE-COS `AES256` state and per-object encryption response proof;
- applied application/CAM and bucket policies;
- overwrite/delete/version-delete/metadata/copy/multipart denial;
- inability of application credentials to change policy, versioning or retention;
- source/CDN SHA-256 equality;
- CloudAudit or equivalent evidence.

No real bucket key, version ID, ETag or request failure evidence can be supplied until authorized staging-only resources exist.

Work package status remains **conditional pass only**. Work package three must not start until the protected COS staging verification succeeds and the sanitized provider, versioning-history, identity-separation, encryption, CDN equality and CloudAudit evidence is committed against the actual validated head and run.

Production environment touched: **No**. No Supabase migration, Vercel/DNS/environment change, COS policy/bucket operation, Release V2 flag change or historical content/asset write was performed.

Required operator evidence before this work package can pass:

- sanitized bucket identity, region and proof that versioning has never been enabled;
- SHA-256 of the rendered CAM/bucket policy and the policy audit output;
- protected workflow run URL and commit SHA;
- sanitized verifier JSON containing proof key, ETag, storage identity, SHA-256 and denial status codes;
- source/CDN SHA-256 equality result;
- CloudAudit export proving which separated identities performed the test;
- documented break-glass owner, approval path and recovery drill.

## Remaining risks

- The existing legacy environment example points to a VileSaint bucket and cannot be reused.
- `x-cos-forbid-overwrite` is not a safety boundary on a bucket with enabled or suspended versioning.
- The repository requires default bucket SSE-COS plus an `AES256` object response, but no real bucket encryption state has been inspected.
- COS Object Lock is allowlist-only and irreversible; it has not been enabled.
- Repository tests prove application protocol, not provider-side IAM enforcement.
- The protected staging workflow has no verified credentials or successful cloud run yet.
- Work package three must not start until real cloud denial and CDN/source equality evidence are attached.
