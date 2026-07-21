import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { fetchJson, requireStagingEnvironment } from "./lib/staging-rehearsal.mjs";

const staging = requireStagingEnvironment(process.env);
const serviceRole = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const action = process.env.STAGING_RPC_ACTION;
const releaseId = process.env.STAGING_RPC_RELEASE_ID;
if (!serviceRole || !action) throw new Error("STAGING_RPC_CONFIG_MISSING");

const headers = {
  apikey: serviceRole,
  Authorization: `Bearer ${serviceRole}`,
  "Content-Type": "application/json",
};
let rpcName;
let payload;
if (action === "get-active") {
  rpcName = "get_active_publication_release";
  payload = {};
} else if (action === "activate") {
  if (!releaseId) throw new Error("STAGING_RPC_RELEASE_ID_MISSING");
  rpcName = "activate_publication_release";
  payload = {
    p_release_id: releaseId,
    p_approver: process.env.STAGING_RPC_ACTOR || "staging-human-approver",
    p_activation_key: process.env.STAGING_RPC_KEY,
  };
} else if (action === "rollback") {
  if (!releaseId) throw new Error("STAGING_RPC_RELEASE_ID_MISSING");
  rpcName = "rollback_publication_release";
  payload = {
    p_release_id: releaseId,
    p_actor: process.env.STAGING_RPC_ACTOR || "staging-human-approver",
    p_activation_key: process.env.STAGING_RPC_KEY,
    p_reason: process.env.STAGING_RPC_REASON || "Release V2 isolated staging rollback rehearsal",
  };
} else throw new Error(`STAGING_RPC_ACTION_INVALID:${action}`);

if (action !== "get-active" && (!payload.p_activation_key || payload.p_activation_key.length < 12)) {
  throw new Error("STAGING_RPC_KEY_INVALID");
}
const result = await fetchJson(`${staging.supabaseUrl}/rest/v1/rpc/${rpcName}`, {
  method: "POST",
  headers,
  body: JSON.stringify(payload),
});
const body = result.body;
const expectedCurrent = process.env.STAGING_EXPECTED_CURRENT_RELEASE_ID;
const currentReleaseId = action === "get-active" ? body?.metadata?.releaseId || null : body?.currentActiveReleaseId || null;
if (expectedCurrent && currentReleaseId !== expectedCurrent) {
  throw new Error(`STAGING_POINTER_MISMATCH:${currentReleaseId || "null"}`);
}
const sanitized = { action, requestedReleaseId: releaseId || null, currentActiveReleaseId: currentReleaseId, result: body };
if (process.env.STAGING_RPC_OUTPUT) {
  await mkdir(dirname(process.env.STAGING_RPC_OUTPUT), { recursive: true });
  await writeFile(process.env.STAGING_RPC_OUTPUT, `${JSON.stringify(sanitized, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify(sanitized, null, 2));
