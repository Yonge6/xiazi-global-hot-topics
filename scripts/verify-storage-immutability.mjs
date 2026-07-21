import { createHash, createHmac, randomUUID } from "node:crypto";

const POLICY_VERSION = "xiazi-cos-immutable-v3";
const TOOL_VERSION = "xiazi-storage-verifier-v3";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

function refuseUnsafeTarget() {
  if (process.env.STORAGE_ENV !== "staging") throw new Error("STORAGE_ENV_MUST_BE_STAGING");
  const bucket = required("COS_BUCKET");
  if (!/xiazi/i.test(bucket) || !/staging/i.test(bucket) || /prod|production|vilesaint/i.test(bucket)) {
    throw new Error("STAGING_BUCKET_NAME_REQUIRED");
  }
  const prefix = process.env.STORAGE_TEST_PREFIX || "release-assets/immutability-verification";
  if (!prefix.startsWith("release-assets/immutability-verification")
    || prefix.includes("..")
    || prefix.includes("\\")
    || prefix.includes("//")) {
    throw new Error("STAGING_TEST_PREFIX_INVALID");
  }
  const cdnVerification = process.env.STORAGE_CDN_VERIFICATION?.trim() || "required";
  if (!new Set(["required", "direct-cos-origin"]).has(cdnVerification)) {
    throw new Error("STORAGE_CDN_VERIFICATION_INVALID");
  }
  let cdn = null;
  if (cdnVerification === "required") {
    cdn = new URL(required("STORAGE_CDN_BASE_URL"));
    if (cdn.protocol !== "https:" || /xiazishuo\.com|vilesaint/i.test(cdn.hostname)) {
      throw new Error("STAGING_CDN_ORIGIN_REQUIRED");
    }
  }
  return { bucket, prefix: prefix.replace(/\/$/, ""), cdn, cdnVerification };
}

function sha1(value) {
  return createHash("sha1").update(value).digest("hex");
}

function hmacSha1(key, value) {
  return createHmac("sha1", key).update(value).digest("hex");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function md5(value) {
  return createHash("md5").update(value).digest("base64");
}

function encode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function authorization(identity, method, pathname, host, query = {}) {
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now - 60};${now + 900}`;
  const parameters = Object.entries(query)
    .map(([key, value]) => [key.toLowerCase(), String(value)])
    .sort(([left], [right]) => left.localeCompare(right));
  const parameterString = parameters.map(([key, value]) => `${encode(key)}=${encode(value)}`).join("&");
  const parameterList = parameters.map(([key]) => encode(key)).join(";");
  const httpString = `${method.toLowerCase()}\n${pathname}\n${parameterString}\nhost=${host}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`;
  const signature = hmacSha1(hmacSha1(identity.secretKey, keyTime), stringToSign);
  return [
    "q-sign-algorithm=sha1",
    `q-ak=${identity.secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    "q-header-list=host",
    `q-url-param-list=${parameterList}`,
    `q-signature=${signature}`,
  ].join("&");
}

function identity(prefix) {
  return {
    secretId: required(`${prefix}_SECRET_ID`),
    secretKey: required(`${prefix}_SECRET_KEY`),
  };
}

const safe = refuseUnsafeTarget();
const region = required("COS_REGION");
const app = identity("STORAGE_APP");
const auditor = identity("STORAGE_AUDIT");
const reader = identity("STORAGE_READER");
const fixture = identity("STORAGE_FIXTURE");
const endpoint = new URL(`https://${safe.bucket}.cos.${region}.myqcloud.com`);

async function request(actor, method, key = "", options = {}) {
  const pathname = key ? `/${key.split("/").map(encode).join("/")}` : "/";
  const url = new URL(pathname, endpoint);
  for (const [name, value] of Object.entries(options.query || {})) url.searchParams.set(name, String(value));
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authorization(actor, method, pathname, endpoint.host, options.query),
      Host: endpoint.host,
      ...options.headers,
    },
    body: options.body,
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  return response;
}

async function responseText(response) {
  return response.text().catch(() => "");
}

async function expectDenied(label, response, allowedStatuses = [403]) {
  const detail = await responseText(response);
  if (!allowedStatuses.includes(response.status)) {
    throw new Error(`${label}_NOT_DENIED:${response.status}`);
  }
  if (response.status === 403 && !/AccessDenied|Forbidden/i.test(detail)) {
    throw new Error(`${label}_DENIAL_NOT_POLICY_PROVEN:${detail.slice(0, 80)}`);
  }
  if (response.status === 409 && !/FileAlreadyExists|Conflict/i.test(detail)) {
    throw new Error(`${label}_CONFLICT_NOT_PROVEN:${detail.slice(0, 80)}`);
  }
  return { label, status: response.status };
}

const versioning = await request(auditor, "GET", "", { query: { versioning: "" } });
const versioningBody = await responseText(versioning);
if (!versioning.ok || /<Status>\s*(Enabled|Suspended)\s*<\/Status>/i.test(versioningBody)) {
  throw new Error(`COS_BUCKET_VERSIONING_NOT_NEVER_ENABLED:${versioning.status}`);
}

const policyResponse = await request(auditor, "GET", "", { query: { policy: "" } });
const appliedPolicy = await responseText(policyResponse);
if (!policyResponse.ok
  || !appliedPolicy.includes("cos:x-cos-forbid-overwrite")
  || !appliedPolicy.includes("name/cos:PutObject")
  || !appliedPolicy.includes("name/cos:GetObject")
  || !appliedPolicy.includes("name/cos:HeadObject")
  || !appliedPolicy.includes("name/cos:InitiateMultipartUpload")
  || !appliedPolicy.includes("name/cos:UploadPart")
  || !appliedPolicy.includes("name/cos:AbortMultipartUpload")
  || appliedPolicy.includes("name/cos:CompleteMultipartUpload")) {
  throw new Error(`COS_APPLIED_POLICY_NOT_VERIFIED:${policyResponse.status}`);
}

const encryption = await request(auditor, "GET", "", { query: { encryption: "" } });
const encryptionBody = await responseText(encryption);
if (!encryption.ok || !/<SSEAlgorithm>\s*AES256\s*<\/SSEAlgorithm>/i.test(encryptionBody)) {
  throw new Error(`COS_BUCKET_DEFAULT_ENCRYPTION_NOT_VERIFIED:${encryption.status}`);
}

const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID()}`;
const key = `${safe.prefix}/${runId}/proof.png`;
const content = Buffer.from(`xiazi immutable storage verification ${runId}`);
const different = Buffer.from(`xiazi immutable storage conflict ${runId}`);
const expectedHash = sha256(content);
const createdAt = new Date().toISOString();
const metadata = {
  "Content-Type": "image/png",
  "Content-Length": String(content.length),
  "Content-MD5": md5(content),
  "x-cos-forbid-overwrite": "true",
  "x-cos-server-side-encryption": "AES256",
  "x-cos-meta-asset-batch-id": `asset_verify_${runId.replace(/-/g, "_")}`.slice(0, 86),
  "x-cos-meta-topic-id": "verification-topic",
  "x-cos-meta-locale": "zh",
  "x-cos-meta-sha256": expectedHash,
  "x-cos-meta-created-at": createdAt,
  "x-cos-meta-uploader-version": TOOL_VERSION,
};

const first = await request(app, "PUT", key, { headers: metadata, body: content });
if (!first.ok) throw new Error(`FIRST_UPLOAD_FAILED:${first.status}:${(await responseText(first)).slice(0, 80)}`);

const head = await request(app, "HEAD", key);
if (!head.ok) throw new Error(`HEAD_AFTER_UPLOAD_FAILED:${head.status}`);
const etag = (head.headers.get("etag") || "").replace(/^"|"$/g, "");
const versionId = head.headers.get("x-cos-version-id");
if (!etag
  || Number(head.headers.get("content-length")) !== content.length
  || head.headers.get("content-type")?.split(";")[0] !== "image/png"
  || head.headers.get("x-cos-server-side-encryption") !== "AES256"
  || head.headers.get("x-cos-meta-sha256") !== expectedHash) {
  throw new Error("HEAD_METADATA_MISMATCH");
}

const sourceRead = await request(app, "GET", key);
if (!sourceRead.ok) throw new Error(`SOURCE_READ_FAILED:${sourceRead.status}`);
const sourceBytes = Buffer.from(await sourceRead.arrayBuffer());
if (sha256(sourceBytes) !== expectedHash) throw new Error("SOURCE_HASH_MISMATCH");

const readerHead = await request(reader, "HEAD", key);
if (!readerHead.ok
  || Number(readerHead.headers.get("content-length")) !== content.length
  || readerHead.headers.get("x-cos-server-side-encryption") !== "AES256") {
  throw new Error(`READER_HEAD_FAILED:${readerHead.status}`);
}
const readerRead = await request(reader, "GET", key);
if (!readerRead.ok || sha256(Buffer.from(await readerRead.arrayBuffer())) !== expectedHash) {
  throw new Error(`READER_READ_FAILED:${readerRead.status}`);
}

const denials = [];
denials.push(await expectDenied("SAME_KEY_SAME_CONTENT", await request(app, "PUT", key, { headers: metadata, body: content }), [409]));
denials.push(await expectDenied("SAME_KEY_DIFFERENT_CONTENT", await request(app, "PUT", key, {
  headers: { ...metadata, "Content-Length": String(different.length), "Content-MD5": md5(different) },
  body: different,
}), [409]));
denials.push(await expectDenied("DELETE_OBJECT", await request(app, "DELETE", key)));
denials.push(await expectDenied("DELETE_OBJECT_VERSION", await request(app, "DELETE", key, {
  query: { versionId: versionId || "immutable-unversioned-proof" },
})));

const copyHeaders = {
  "x-cos-copy-source": `${endpoint.host}/${key}`,
  "x-cos-forbid-overwrite": "true",
};
denials.push(await expectDenied("METADATA_REPLACEMENT", await request(app, "PUT", key, {
  headers: { ...copyHeaders, "x-cos-metadata-directive": "Replaced", "x-cos-meta-sha256": sha256(different) },
}), [409, 403]));
denials.push(await expectDenied("COPY_OVERWRITE", await request(app, "PUT", key, { headers: copyHeaders }), [409, 403]));
denials.push(await expectDenied("INITIATE_MULTIPART", await request(app, "POST", key, {
  query: { uploads: "" },
})));

const multipartKey = `${safe.prefix}/${runId}/multipart-overwrite.png`;
const multipartBaseline = Buffer.from(`xiazi multipart overwrite baseline ${runId}`);
const multipartBaselineMetadata = {
  ...metadata,
  "Content-Length": String(multipartBaseline.length),
  "Content-MD5": md5(multipartBaseline),
  "x-cos-meta-sha256": sha256(multipartBaseline),
};
const multipartBaselineUpload = await request(app, "PUT", multipartKey, {
  headers: multipartBaselineMetadata,
  body: multipartBaseline,
});
if (!multipartBaselineUpload.ok) throw new Error(`MULTIPART_BASELINE_UPLOAD_FAILED:${multipartBaselineUpload.status}`);

const multipartInitiate = await request(fixture, "POST", multipartKey, {
  query: { uploads: "" },
  headers: { "Content-Type": "image/png" },
});
const multipartInitiateBody = await responseText(multipartInitiate);
const uploadId = multipartInitiateBody.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
if (!multipartInitiate.ok || !uploadId) {
  throw new Error(`MULTIPART_FIXTURE_INITIATE_FAILED:${multipartInitiate.status}`);
}

denials.push(await expectDenied("UPLOAD_PART", await request(app, "PUT", multipartKey, {
  query: { partNumber: "1", uploadId },
  headers: { "Content-Type": "image/png" },
  body: different,
})));

const multipartPart = await request(fixture, "PUT", multipartKey, {
  query: { partNumber: "1", uploadId },
  headers: { "Content-Type": "image/png", "Content-Length": String(different.length), "Content-MD5": md5(different) },
  body: different,
});
const multipartPartEtag = multipartPart.headers.get("etag");
if (!multipartPart.ok || !multipartPartEtag) {
  throw new Error(`MULTIPART_FIXTURE_PART_FAILED:${multipartPart.status}`);
}

const completeBody = `<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>${multipartPartEtag}</ETag></Part></CompleteMultipartUpload>`;
const completeResponse = await request(app, "POST", multipartKey, {
  query: { uploadId },
  headers: { "Content-Type": "application/xml", "x-cos-forbid-overwrite": "true" },
  body: completeBody,
});
const completeDetail = await responseText(completeResponse);
const abortResponse = await request(fixture, "DELETE", multipartKey, { query: { uploadId } });
if (!abortResponse.ok) throw new Error(`MULTIPART_FIXTURE_ABORT_FAILED:${abortResponse.status}`);
if (completeResponse.status !== 403 || !/AccessDenied|Forbidden/i.test(completeDetail)) {
  throw new Error(`MULTIPART_COMPLETE_NOT_DENIED:${completeResponse.status}`);
}
denials.push({ label: "MULTIPART_COMPLETE", status: completeResponse.status });

const multipartUnchanged = await request(app, "GET", multipartKey);
if (!multipartUnchanged.ok
  || sha256(Buffer.from(await multipartUnchanged.arrayBuffer())) !== sha256(multipartBaseline)) {
  throw new Error("MULTIPART_OVERWRITE_CHANGED_OBJECT");
}
denials.push(await expectDenied("PUT_BUCKET_POLICY", await request(app, "PUT", "", {
  query: { policy: "" }, headers: { "Content-Type": "application/json" }, body: appliedPolicy,
})));
denials.push(await expectDenied("PUT_BUCKET_VERSIONING", await request(app, "PUT", "", {
  query: { versioning: "" }, headers: { "Content-Type": "application/xml" },
  body: "<VersioningConfiguration><Status>Suspended</Status></VersioningConfiguration>",
})));
denials.push(await expectDenied("PUT_BUCKET_OBJECT_LOCK", await request(app, "PUT", "", {
  query: { "object-lock": "" }, headers: { "Content-Type": "application/xml" },
  body: "<ObjectLockConfiguration><ObjectLockEnabled>Enabled</ObjectLockEnabled></ObjectLockConfiguration>",
})));
denials.push(await expectDenied("PUT_BUCKET_ENCRYPTION", await request(app, "PUT", "", {
  query: { encryption: "" }, headers: { "Content-Type": "application/xml" },
  body: "<ServerSideEncryptionConfiguration><Rule><ApplyServerSideEncryptionByDefault><SSEAlgorithm>KMS</SSEAlgorithm></ApplyServerSideEncryptionByDefault></Rule></ServerSideEncryptionConfiguration>",
})));
denials.push(await expectDenied("DELETE_BUCKET_ENCRYPTION", await request(app, "DELETE", "", {
  query: { encryption: "" },
})));

const readerDeniedKey = `${safe.prefix}/${runId}/reader-write-denied.png`;
denials.push(await expectDenied("READER_PUT_OBJECT", await request(reader, "PUT", readerDeniedKey, {
  headers: metadata,
  body: content,
})));
denials.push(await expectDenied("READER_DELETE_OBJECT", await request(reader, "DELETE", key)));
denials.push(await expectDenied("READER_PUT_BUCKET_POLICY", await request(reader, "PUT", "", {
  query: { policy: "" }, headers: { "Content-Type": "application/json" }, body: appliedPolicy,
})));

const auditorDeniedKey = `${safe.prefix}/${runId}/auditor-write-denied.png`;
denials.push(await expectDenied("AUDITOR_PUT_OBJECT", await request(auditor, "PUT", auditorDeniedKey, {
  headers: metadata,
  body: content,
})));
denials.push(await expectDenied("AUDITOR_DELETE_OBJECT", await request(auditor, "DELETE", key)));
denials.push(await expectDenied("AUDITOR_PUT_BUCKET_POLICY", await request(auditor, "PUT", "", {
  query: { policy: "" }, headers: { "Content-Type": "application/json" }, body: appliedPolicy,
})));

const idempotentRead = await request(app, "GET", key);
const idempotentHash = sha256(Buffer.from(await idempotentRead.arrayBuffer()));
if (!idempotentRead.ok || idempotentHash !== expectedHash) throw new Error("IDEMPOTENT_CONTENT_CHANGED");

let cdnSourceHashMatches = null;
let cdnVerificationStatus = "not-applicable-for-direct-cos-origin";
if (safe.cdnVerification === "required") {
  const cdnUrl = new URL(key, safe.cdn.toString().endsWith("/") ? safe.cdn : `${safe.cdn}/`);
  const cdnResponse = await fetch(cdnUrl, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!cdnResponse.ok) throw new Error(`CDN_READ_FAILED:${cdnResponse.status}`);
  const cdnHash = sha256(Buffer.from(await cdnResponse.arrayBuffer()));
  if (cdnHash !== expectedHash) throw new Error("CDN_SOURCE_HASH_MISMATCH");
  cdnSourceHashMatches = true;
  cdnVerificationStatus = "passed";
}

console.log(JSON.stringify({
  ok: true,
  storageEnv: "staging",
  provider: "tencent-cos",
  policyVersion: POLICY_VERSION,
  verificationToolVersion: TOOL_VERSION,
  key,
  versionId,
  storageVersionId: versionId || `cos-unversioned:${etag}:${expectedHash}`,
  etag,
  sha256: expectedHash,
  sizeBytes: content.length,
  contentType: "image/png",
  serverSideEncryption: "AES256",
  overwriteDenied: true,
  deleteDenied: true,
  identitySeparationVerified: true,
  policyVerified: true,
  cdnVerificationStatus,
  cdnSourceHashMatches,
  denials,
  verifiedAt: new Date().toISOString(),
}, null, 2));
