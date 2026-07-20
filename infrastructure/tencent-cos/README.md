# Tencent COS immutable release asset policy

Policy version: `xiazi-cos-immutable-v2`.

These files are redacted templates. `staging-bucket-policy.template.json` is the deployable composition of the uploader, auditor and CDN-reader grants; the narrower files document each runtime boundary. Replace placeholders only in an approved staging change record; never commit rendered account IDs, credentials or production bucket names.

## Required bucket state

- dedicated Xiazi staging bucket whose name contains `staging`;
- bucket versioning must have **never** been enabled or suspended;
- HTTPS only, bucket default SSE-COS `AES256`, and an `AES256` response header on every proof object;
- no lifecycle rule may delete or transform `release-assets/` during the required retention window;
- uploader policy must force `x-cos-forbid-overwrite:true`.

Tencent COS documents that the no-overwrite header is ineffective after versioning is enabled or suspended. Do not combine this policy with a versioned bucket and do not use versioning as proof of immutable public keys.

## Identities

`immutable-uploader-policy.template.json` grants only create-with-no-overwrite plus GET/HEAD-equivalent verification under `release-assets/`. All deletion, object ACL/tag/retention mutation, copy/multipart operations and bucket policy/versioning/object-lock/default-encryption changes remain implicitly denied because the runtime identity receives no other COS policy. The protected verifier proves those denials against the provider rather than trusting action names in a static template.

`auditor-policy.template.json` grants only the bucket-state reads used by the protected verifier plus proof-object reads. It cannot upload, delete or mutate policy.

`public-reader-policy.template.json` grants only HTTPS `GetObject`, `HeadObject` and `OptionsObject` to a staging read-only CAM identity and Tencent CDN's account-scoped `service/cdn` identity. The protected verifier uses the staging identity to prove read access and write/delete/policy denial without requiring CDN activation. The future CDN runtime does not receive a CAM user's long-lived secret.

Break-glass administration is intentionally not represented as an application policy. It must remain outside runtime and ordinary CI, require MFA or independent approval, and write CloudAudit records.

## Object Lock

COS Object Lock/WORM is allowlist-only and enabling it is irreversible. This branch does not enable it. If adopted later, use a new dedicated bucket and a separately approved retention design; rerun all create-only, overwrite, delete, metadata, copy and multipart tests.
