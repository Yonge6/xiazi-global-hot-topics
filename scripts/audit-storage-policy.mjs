import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploaderPath = path.join(root, "infrastructure/tencent-cos/immutable-uploader-policy.template.json");
const readerPath = path.join(root, "infrastructure/tencent-cos/public-reader-policy.template.json");
const auditorPath = path.join(root, "infrastructure/tencent-cos/auditor-policy.template.json");
const bucketPath = path.join(root, "infrastructure/tencent-cos/staging-bucket-policy.template.json");
const uploaderText = await readFile(uploaderPath, "utf8");
const readerText = await readFile(readerPath, "utf8");
const auditorText = await readFile(auditorPath, "utf8");
const bucketText = await readFile(bucketPath, "utf8");
const uploader = JSON.parse(uploaderText);
const reader = JSON.parse(readerText);
const auditor = JSON.parse(auditorText);
const bucket = JSON.parse(bucketText);

function fail(message) {
  throw new Error(`STORAGE_POLICY_AUDIT_FAILED:${message}`);
}

const forbiddenText = [
  /COS_SECRET/i,
  /SECRET_KEY/i,
  /vilesaint/i,
  /xiazishuo\.com/i,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
];
for (const [name, text] of [["uploader", uploaderText], ["reader", readerText], ["auditor", auditorText], ["bucket", bucketText]]) {
  if (forbiddenText.some((pattern) => pattern.test(text))) fail(`${name}:sensitive-or-production-value`);
  for (const placeholder of ["${OWNER_UIN}", "${APP_ID}", "${COS_REGION}", "${STAGING_BUCKET}"]) {
    if (!text.includes(placeholder)) fail(`${name}:missing-placeholder:${placeholder}`);
  }
}

for (const placeholder of ["${UPLOADER_UIN}", "${AUDITOR_UIN}", "${READER_UIN}"]) {
  if (!bucketText.includes(placeholder)) fail(`bucket:missing-placeholder:${placeholder}`);
}
if (!bucketText.includes("qcs::cam::uin/${OWNER_UIN}:service/cdn")) fail("bucket:cdn-service-principal-missing");

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

for (const statement of statements) {
  for (const resource of statement.resource || []) {
    if (!resource.includes("${STAGING_BUCKET}")) fail("uploader:bucket-placeholder-missing");
    if (!resource.endsWith("${STAGING_BUCKET}/*") && !resource.endsWith("${STAGING_BUCKET}/release-assets/*")) {
      fail("uploader:resource-outside-release-assets");
    }
  }
  if (statement.effect === "allow") {
    for (const action of statement.action || []) {
      if (!["name/cos:PutObject", "name/cos:GetObject", "name/cos:HeadObject"].includes(action)) fail(`uploader:unexpected-allow:${action}`);
    }
  }
  if (statement.effect === "deny" && !actions(statement).has("name/cos:PutObject")) {
    fail("uploader:unexpected-explicit-deny");
  }
}

if (!readerText.includes("qcs::cam::uin/${OWNER_UIN}:uin/${READER_UIN}")) fail("reader:identity-placeholder-missing");
if (!readerText.includes("qcs::cam::uin/${OWNER_UIN}:service/cdn")) fail("reader:cdn-service-principal-missing");
if (reader.statement.length !== 1
  || reader.statement[0].effect !== "allow"
  || JSON.stringify(reader.statement[0].action) !== JSON.stringify([
    "name/cos:GetObject",
    "name/cos:HeadObject",
    "name/cos:OptionsObject",
  ])
  || reader.statement[0].condition?.bool_equal?.["cos:secure-transport"] !== "true") {
  fail("reader:not-strict-read-only");
}

if (!auditorText.includes("${AUDITOR_UIN}")) fail("auditor:identity-placeholder-missing");
const auditorAllowed = new Set(auditor.statement.flatMap((statement) => statement.action || []));
for (const action of auditorAllowed) {
  if (!["name/cos:GetBucketVersioning", "name/cos:GetBucketPolicy", "name/cos:GetBucketEncryption", "name/cos:GetObject", "name/cos:HeadObject"].includes(action)) {
    fail(`auditor:unexpected-allow:${action}`);
  }
}
if (bucket.statement.length !== uploader.statement.length + auditor.statement.length + reader.statement.length) {
  fail("bucket:composition-size-mismatch");
}
const composed = [...uploader.statement, ...auditor.statement, ...reader.statement];
if (JSON.stringify(bucket.statement) !== JSON.stringify(composed)) fail("bucket:composition-mismatch");

console.log("Storage policy template audit passed (xiazi-cos-immutable-v2).");
