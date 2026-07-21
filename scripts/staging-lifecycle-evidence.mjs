import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { requireStagingEnvironment } from "./lib/staging-rehearsal.mjs";

const staging = requireStagingEnvironment(process.env);
const serviceRole = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const releaseA = process.env.STAGING_RELEASE_A_ID;
const releaseB = process.env.STAGING_RELEASE_B_ID;
if (!serviceRole || !releaseA || !releaseB) throw new Error("STAGING_LIFECYCLE_EVIDENCE_CONFIG_MISSING");
const headers = { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` };

async function rows(table, query) {
  const response = await fetch(`${staging.supabaseUrl}/rest/v1/${table}?${query}`, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(`STAGING_EVIDENCE_QUERY_FAILED:${table}:${response.status}`);
  return response.json();
}

const releases = await rows("publication_releases", `release_id=in.(${releaseA},${releaseB})&select=release_id,issue_date,content_hash,release_hash,schema_version,status,source_snapshot_hash,poster_manifest_hash,ready_at,activated_at,deployed_at&order=created_at.asc`);
if (releases.length !== 2) throw new Error("STAGING_RELEASE_EVIDENCE_INCOMPLETE");
const posters = await rows("publication_poster_checks", `release_id=in.(${releaseA},${releaseB})&select=release_id,topic_id,locale,content_hash,perceptual_hash,width,height,format,storage_version_id,etag&order=release_id.asc,topic_id.asc,locale.asc`);
if (posters.filter((item) => item.release_id === releaseA).length !== 18
  || posters.filter((item) => item.release_id === releaseB).length !== 18) {
  throw new Error("STAGING_POSTER_EVIDENCE_INCOMPLETE");
}
const sources = await rows("publication_source_snapshots", `release_id=in.(${releaseA},${releaseB})&select=release_id,source_id,topic_id,content_hash,correction_status,review_provider,review_model&order=release_id.asc,source_id.asc`);
if (sources.filter((item) => item.release_id === releaseA).length < 8
  || sources.filter((item) => item.release_id === releaseB).length < 8) {
  throw new Error("STAGING_SOURCE_EVIDENCE_INCOMPLETE");
}
const [channel] = await rows("publication_channels", "channel=eq.current&select=active_release_id,pointer_version,updated_at");
if (channel?.active_release_id !== releaseB) throw new Error(`STAGING_FINAL_POINTER_NOT_B:${channel?.active_release_id}`);
const allEvents = await rows("publication_channel_events", "channel=eq.current&select=id,previous_release_id,next_release_id,action,actor,reason,activation_key,created_at&order=id.asc");
const runId = process.env.GITHUB_RUN_ID || "";
const events = allEvents.filter((event) => !runId || String(event.activation_key).includes(runId));
const expectedSequence = [
  ["activate", releaseA],
  ["activate", releaseB],
  ["rollback", releaseA],
  ["activate", releaseB],
];
if (events.length !== expectedSequence.length
  || events.some((event, index) => event.action !== expectedSequence[index][0] || event.next_release_id !== expectedSequence[index][1])) {
  throw new Error(`STAGING_AUDIT_EVENT_SEQUENCE_INVALID:${events.map((event) => `${event.action}:${event.next_release_id}`).join(",")}`);
}

const releaseEvidence = releases.map((release) => ({
  releaseId: release.release_id,
  issueDate: release.issue_date,
  contentHash: release.content_hash,
  releaseHash: release.release_hash,
  releaseSchemaVersion: release.schema_version,
  status: release.status,
  sourceSnapshotHash: release.source_snapshot_hash,
  posterManifestHash: release.poster_manifest_hash,
  readyAt: release.ready_at,
  activatedAt: release.activated_at,
  deployedAt: release.deployed_at,
  sourceCount: sources.filter((item) => item.release_id === release.release_id).length,
  posters: posters.filter((item) => item.release_id === release.release_id).map((poster) => ({
    topicId: poster.topic_id,
    locale: poster.locale,
    contentHash: poster.content_hash,
    perceptualHash: poster.perceptual_hash,
    width: poster.width,
    height: poster.height,
    format: poster.format,
    providerObjectIdentity: poster.storage_version_id,
    etag: poster.etag,
  })),
}));

const evidence = {
  schemaVersion: "release-v2-staging-lifecycle-v1",
  verifiedAt: new Date().toISOString(),
  commitSha: process.env.GITHUB_SHA || null,
  workflowRunUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && runId
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}` : null,
  releaseA: releaseEvidence.find((release) => release.releaseId === releaseA),
  releaseB: releaseEvidence.find((release) => release.releaseId === releaseB),
  currentPointer: channel,
  auditEvents: events,
  lifecycle: ["activate-A", "activate-B", "rollback-A", "reactivate-B"],
  secretsIncluded: false,
  productionResourcesIncluded: false,
};
if (process.env.STAGING_LIFECYCLE_OUTPUT) {
  await mkdir(dirname(process.env.STAGING_LIFECYCLE_OUTPUT), { recursive: true });
  await writeFile(process.env.STAGING_LIFECYCLE_OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify(evidence, null, 2));
