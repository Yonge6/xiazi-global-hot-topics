import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { fetchJson, requireStagingEnvironment } from "./lib/staging-rehearsal.mjs";

const staging = requireStagingEnvironment(process.env);
const secret = process.env.STAGING_RELEASE_STAGE_SECRET;
const payloadPath = process.env.STAGING_RELEASE_PAYLOAD;
if (!secret || !payloadPath) throw new Error("STAGING_STAGE_CONFIG_MISSING");
const payload = JSON.parse(await readFile(payloadPath, "utf8"));
const result = await fetchJson(`${staging.webUrl}/api/internal/releases/stage`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
if (result.body.status !== "ready_for_approval" || !result.body.releaseId) {
  throw new Error("STAGING_RELEASE_NOT_READY_FOR_APPROVAL");
}
const sanitized = {
  releaseId: result.body.releaseId,
  issueDate: result.body.issueDate,
  contentHash: result.body.contentHash,
  status: result.body.status,
  published: result.body.published,
  validationReport: result.body.validationReport,
};
if (process.env.STAGING_STAGE_OUTPUT) {
  await mkdir(dirname(process.env.STAGING_STAGE_OUTPUT), { recursive: true });
  await writeFile(process.env.STAGING_STAGE_OUTPUT, `${JSON.stringify(sanitized, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify(sanitized, null, 2));
