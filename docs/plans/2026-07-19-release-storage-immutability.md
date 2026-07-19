# Release V2 immutable asset storage implementation plan

## Scope

This work package applies only to future issues after `2026-07-18`. It does not alter historical content, posters, archives or Story Pool records, does not enable Release V2 and does not modify production Supabase, Vercel, DNS, COS buckets, credentials or policies.

The branch is stacked on `codex/release-review-services` and must remain a Draft pull request. Work package three is out of scope.

## Provider identification

The repository's actual binary asset backend is Tencent Cloud Object Storage (COS):

- `apps/web/src/lib/cos/storage.ts` signs requests for `*.cos.<region>.myqcloud.com` and reads `COS_SECRET_ID`, `COS_SECRET_KEY`, `COS_BUCKET` and `COS_REGION`.
- `NEXT_PUBLIC_COS_BASE_URL` is used as the public poster origin.
- legacy Studio and scripts upload mutable poster keys directly through COS REST requests.
- `DECISIONS.md` D-016 records COS as binary asset storage.
- no AWS S3, Cloudflare R2, Google Cloud Storage, Azure Blob or MinIO upload SDK is present.

The checked-in environment example points to a legacy VileSaint COS bucket. That bucket is not an acceptable Xiazi staging target and must not be read, written or reconfigured by this work package. A dedicated Xiazi staging COS bucket/prefix whose name includes `staging` is required for cloud verification.

There is no linked Vercel project or Vercel CLI in this isolated worktree, so repository evidence confirms the variable names but not any deployed value. No provider or policy state is inferred from unavailable Vercel configuration.

## Tencent COS capability decision

Official Tencent COS documentation confirms:

- `PUT Object` and `Complete Multipart Upload` accept `x-cos-forbid-overwrite:true`; an existing key causes `409 FileAlreadyExists`.
- CAM condition key `cos:x-cos-forbid-overwrite` can require the header and explicitly deny requests that omit it.
- the no-overwrite header is ineffective after bucket versioning has ever been enabled, including the suspended state.
- Object Lock/WORM can prevent object modification and deletion, but is allowlist-only and enabling it is irreversible. It is not enabled by this PR.
- CAM supports explicit deny and HTTPS conditions. COS supports default bucket SSE-COS; the staging verifier requires `AES256` both in the bucket encryption policy and each proof object's response headers.

Therefore the code target is a dedicated COS bucket that has never enabled versioning, with CAM forcing the no-overwrite header. The application must fail closed unless a protected staging verification proves that bucket state and policy. `x-cos-forbid-overwrite` is the service-side atomic conditional create primitive; a preliminary HEAD is only an idempotency optimization and never the safety boundary.

If the staging bucket has ever enabled versioning, or its state cannot be proven, the required solution is a different dedicated never-versioned bucket or an approved write-once proxy/WORM design. The code must return `IMMUTABLE_ASSET_POLICY_UNVERIFIED`; it must not pretend versioning alone provides immutable public keys.

## Implementation steps

### Step 1: shared storage identity and path rules

- Output: contracts for immutable object metadata, object proof and storage verification; domain functions that construct and validate `release-assets/{assetBatchId}/{locale}/{slot}.png`.
- Test: reject traversal, encoded traversal, backslashes, duplicate separators, mutable `current/`, invalid batch IDs/locales/slots/origins and incomplete or duplicate 18-slot manifests.

### Step 2: create-only storage interface and COS adapter

- Output: `ImmutableAssetStore` exposing only `createObject`, `headObject` and `readObject`; COS implementation signs HTTPS REST requests, requires `x-cos-forbid-overwrite:true`, stores immutable metadata, rereads bytes and validates SHA-256/size/content type/SSE-COS `AES256` proof.
- Test: first write, same-content idempotency, different-content conflict, concurrent writers, post-write hash/size/type mismatch and provider-without-conditional-write failure.

### Step 3: Release V2 storage hard gate

- Output: storage gate verifies 18 objects and reconciles COS proofs against independently fetched poster bytes; validation report includes provider, policy version, asset batch, manifest hash, object hashes/version identities, verification time/tool version and overwrite/delete/policy booleans.
- Test: missing configuration or `policyVerified=false`, incomplete proof, changed hash/version identity and origin mismatch never call `stage_publication_release`.

### Step 4: service-side policy templates and credential separation

- Output: redacted Tencent COS bucket/CAM policy templates for create-only upload, public/CDN read and break-glass boundaries. Upload identity has no delete, ACL, retention, multipart, bucket-policy or versioning permissions.
- Test: static policy audit requires the no-overwrite condition, HTTPS, prefix scope, deny actions and placeholders; it rejects secrets and production bucket names.

### Step 5: local integration and staging-only verifier

- Output: rebuildable local COS-like HTTP test server; `scripts/verify-storage-immutability.mjs` tests real staging operations with production guards and nonzero failure exit.
- Test: local integration proves conditional create and reread verification only. Cloud script remains explicitly unexecuted without a dedicated staging bucket and credentials.

### Step 6: CI, evidence and Draft PR

- Output: independent storage CI for contracts/domain, path/manifest, adapter, local concurrency, policy audit, web integration, Build, E2E and fail-closed smoke; manual environment-gated cloud verification job reports not executed when credentials are absent.
- Test: local full check/build/E2E pass, stacked Draft PR base is `codex/release-review-services`, remote checks pass and all production/history guards remain intact.

## Identity and credential boundaries

Application upload identity:

- create new PNGs only under the dedicated staging `release-assets/` prefix;
- HEAD/GET those objects for verification;
- PUT is allowed only when `x-cos-forbid-overwrite=true` and over HTTPS;
- no DELETE, ACL/tag/metadata replacement, multipart, retention, bucket policy, versioning or object-lock administration.

Public/CDN identity:

- read accepted objects only;
- no write, delete or policy rights.

Break-glass identity:

- never placed in application runtime or ordinary GitHub Actions;
- requires MFA/independent approval and cloud audit logging;
- credentials are never committed.

## Stop conditions and current blockers

No cloud mutation is authorized. Real staging policy verification stops until all of the following exist: a dedicated Xiazi staging COS bucket, proof that versioning has never been enabled, a create-only application identity, a separate read/CDN path, policy-management access for an authorized operator and safe staging-only credentials. WORM/Object Lock cannot be enabled by this PR because it is allowlist-gated and irreversible.
