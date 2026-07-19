# Tencent COS immutable release asset policy

Policy version: `xiazi-cos-immutable-v1`.

These files are redacted templates, not applied cloud configuration. Replace placeholders only in an approved staging change record; never commit rendered account IDs, credentials or production bucket names.

## Required bucket state

- dedicated Xiazi staging bucket whose name contains `staging`;
- bucket versioning must have **never** been enabled or suspended;
- HTTPS only, bucket default SSE-COS `AES256`, and an `AES256` response header on every proof object;
- no lifecycle rule may delete or transform `release-assets/` during the required retention window;
- uploader policy must force `x-cos-forbid-overwrite:true`.

Tencent COS documents that the no-overwrite header is ineffective after versioning is enabled or suspended. Do not combine this policy with a versioned bucket and do not use versioning as proof of immutable public keys.

## Identities

`immutable-uploader-policy.template.json` grants only create-with-no-overwrite plus GET/HEAD-equivalent verification under `release-assets/`. It explicitly denies deletion, object ACL/tag/retention mutation, copy/multipart operations and bucket policy/versioning/object-lock/default-encryption changes.

`public-reader-policy.template.json` grants only HTTPS `GetObject` to the CDN/read identity.

Break-glass administration is intentionally not represented as an application policy. It must remain outside runtime and ordinary CI, require MFA or independent approval, and write CloudAudit records.

## Object Lock

COS Object Lock/WORM is allowlist-only and enabling it is irreversible. This branch does not enable it. If adopted later, use a new dedicated bucket and a separately approved retention design; rerun all create-only, overwrite, delete, metadata, copy and multipart tests.
