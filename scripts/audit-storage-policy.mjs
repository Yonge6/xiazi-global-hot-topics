import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploaderPath = path.join(root, "infrastructure/tencent-cos/immutable-uploader-policy.template.json");
const readerPath = path.join(root, "infrastructure/tencent-cos/public-reader-policy.template.json");
const uploaderText = await readFile(uploaderPath, "utf8");
const readerText = await readFile(readerPath, "utf8");
const uploader = JSON.parse(uploaderText);
const reader = JSON.parse(readerText);

function fail(message) {
  throw new Error(`STORAGE_POLICY_AUDIT_FAILED:${message}`);
}

const forbiddenText = [
  /COS_SECRET/i,
  /SECRET_KEY/i,
  /vilesaint/i,
  /1258992379/,
  /xiazishuo\.com/i,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
];
for (const [name, text] of [["uploader", uploaderText], ["reader", readerText]]) {
  if (forbiddenText.some((pattern) => pattern.test(text))) fail(`${name}:sensitive-or-production-value`);
  for (const placeholder of ["${OWNER_UIN}", "${APP_ID}", "${COS_REGION}", "${STAGING_BUCKET}"]) {
    if (!text.includes(placeholder)) fail(`${name}:missing-placeholder:${placeholder}`);
  }
}

const statements = uploader.statement;
if (!Array.isArray(statements)) fail("uploader:statement-missing");
const actions = (statement) => new Set(statement.action || []);
const putAllow = statements.find((statement) => statement.effect === "allow" && actions(statement).has("name/cos:PutObject"));
if (putAllow?.condition?.string_equal?.["cos:x-cos-forbid-overwrite"] !== "true") {
  fail("uploader:no-overwrite-condition-missing");
}
if (putAllow?.condition?.string_equal?.["cos:content-type"] !== "image/png") fail("uploader:png-condition-missing");
if (putAllow?.condition?.bool_equal?.["cos:secure-transport"] !== "true") fail("uploader:https-condition-missing");

const unsafePutDeny = statements.find((statement) => statement.effect === "deny"
  && actions(statement).has("name/cos:PutObject")
  && statement.condition?.string_not_equal_if_exist?.["cos:x-cos-forbid-overwrite"] === "true");
if (!unsafePutDeny) fail("uploader:unsafe-put-deny-missing");

const requiredDenied = [
  "name/cos:DeleteObject",
  "name/cos:DeleteMultipleObjects",
  "name/cos:PutObjectACL",
  "name/cos:CompleteMultipartUpload",
  "name/cos:PutObjectCopy",
  "name/cos:PutObjectRetention",
  "name/cos:PutBucketPolicy",
  "name/cos:PutBucketVersioning",
  "name/cos:PutBucketObjectLockConfiguration",
  "name/cos:PutBucketEncryption",
  "name/cos:DeleteBucketEncryption",
];
const denied = new Set(statements
  .filter((statement) => statement.effect === "deny")
  .flatMap((statement) => statement.action || []));
for (const action of requiredDenied) if (!denied.has(action)) fail(`uploader:deny-missing:${action}`);

for (const statement of statements) {
  for (const resource of statement.resource || []) {
    if (!resource.includes("${STAGING_BUCKET}")) fail("uploader:bucket-placeholder-missing");
    if (!resource.endsWith("${STAGING_BUCKET}/*") && !resource.endsWith("${STAGING_BUCKET}/release-assets/*")) {
      fail("uploader:resource-outside-release-assets");
    }
  }
  if (statement.effect === "allow") {
    for (const action of statement.action || []) {
      if (!["name/cos:PutObject", "name/cos:GetObject"].includes(action)) fail(`uploader:unexpected-allow:${action}`);
    }
  }
}

if (!readerText.includes("${CDN_READER_UIN}")) fail("reader:identity-placeholder-missing");
if (reader.statement.length !== 1
  || reader.statement[0].effect !== "allow"
  || JSON.stringify(reader.statement[0].action) !== JSON.stringify(["name/cos:GetObject"])
  || reader.statement[0].condition?.bool_equal?.["cos:secure-transport"] !== "true") {
  fail("reader:not-strict-read-only");
}

console.log("Storage policy template audit passed (xiazi-cos-immutable-v1).");
