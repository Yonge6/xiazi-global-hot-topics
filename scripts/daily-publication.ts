#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, open, unlink, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { parseIssue } from "@xiazi/contracts";
import { buildDailyIssue } from "../packages/domain/src/daily-issue";
import { uploadImmutableReleasePosters } from "../apps/web/src/server/storage/immutable-upload-service";
import { runPreflight } from "./preflight-daily-publication";
import { assertReleaseBundle, COS_ORIGIN, publishCurrentReleaseBundle } from "./publish-current-release-manifest.mjs";

const digest = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const save = (name: string, value: unknown) => writeFile(name, `${JSON.stringify(value, null, 2)}\n`);
const site = "https://xiazishuo.com";

async function credentials() {
  const filename = process.env.XIAZI_PUBLISHER_CONFIG || path.join(os.homedir(), ".config/xiazi/cos-publisher.json");
  const info = await stat(filename);
  if ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()) throw new Error("PUBLISHER_CONFIG_MUST_BE_OWNER_ONLY");
  const config = JSON.parse(await readFile(filename, "utf8"));
  for (const name of ["COS_SECRET_ID", "COS_SECRET_KEY", "COS_BUCKET", "COS_REGION",
    "COS_IMMUTABLE_VERSIONING_STATE", "RELEASE_STORAGE_POLICY_VERSION", "RELEASE_STORAGE_POLICY_VERIFIED_AT",
    "RELEASE_STORAGE_VERIFICATION_TOOL_VERSION", "RELEASE_STORAGE_OVERWRITE_DENIED",
    "RELEASE_STORAGE_DELETE_DENIED", "RELEASE_STORAGE_POLICY_VERIFIED"]) {
    if (!config[name]) throw new Error(`PUBLISHER_CONFIG_MISSING:${name}`);
    process.env[name] = String(config[name]);
  }
  if (`https://${config.COS_BUCKET}.cos.${config.COS_REGION}.myqcloud.com` !== COS_ORIGIN) throw new Error("COS_SCOPE_MISMATCH");
  process.env.NEXT_PUBLIC_COS_BASE_URL = COS_ORIGIN;
  process.env.RELEASE_ASSET_ORIGINS = COS_ORIGIN;
  process.env.COS_REQUEST_TIMEOUT_MS = "120000";
}

async function liveAcceptance(issue: ReturnType<typeof parseIssue>, manifest: any) {
  const response = await fetch(`${site}/api/content/`, { signal: AbortSignal.timeout(30000), cache: "no-store" });
  const current = await response.json();
  if (!response.ok || current.issueDate !== issue.issueDate || current.topics?.length !== 9
    || current.releaseId !== manifest.releaseId || current.assetVersion !== manifest.releaseId) throw new Error("LIVE_CURRENT_MISMATCH");
  const archive = await fetch(`${site}/api/archive/`, { signal: AbortSignal.timeout(30000) }).then((r) => r.json());
  if (!archive.issues?.some((row: any) => (typeof row === "string" ? row : row.issueDate) === issue.issueDate)) throw new Error("LIVE_ARCHIVE_MISSING");
  for (const locale of ["zh", "en"]) {
    const page = await fetch(`${site}/${locale}/`, { signal: AbortSignal.timeout(30000) });
    if (!page.ok || !(await page.text()).includes(issue.issueDate)) throw new Error(`LIVE_PAGE_INVALID:${locale}`);
  }
  const results = [];
  // Check both routes; download a shared immutable destination only once per slot.
  for (const poster of manifest.posters) {
    const topic = issue.topics.find((t) => t.id === poster.topicId)!;
    for (const archived of [false, true]) {
      const url = `${site}/api/posters/${poster.locale}/${topic.slug}/?v=${manifest.releaseId}${archived ? `&issueDate=${issue.issueDate}` : ""}`;
      const route = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30000) });
      const location = route.headers.get("location");
      if (![302, 307, 308].includes(route.status) || !location) throw new Error(`LIVE_POSTER_ROUTE_INVALID:${url}`);
      const target = new URL(location, site);
      if (`${target.origin}${target.pathname}` !== poster.url) throw new Error(`LIVE_POSTER_TARGET_INVALID:${url}`);
      results.push({ locale: poster.locale, slug: topic.slug, archived, status: route.status, ok: true });
    }
  }
  return { ok: true, issueDate: issue.issueDate, releaseId: manifest.releaseId, currentPosters: 18, archivePosters: 18, routes: results };
}

export async function main() {
  const { values } = parseArgs({ options: {
    "poster-root": { type: "string" }, "issue-spec": { type: "string" },
    "adopt-manifest": { type: "string" }, "adopt-issue": { type: "string" },
    rollback: { type: "string" }, "dry-run": { type: "boolean" },
  } });
  const root = path.resolve(values["poster-root"] || ".");
  const lockPath = path.join(root, ".publication.lock");
  const lock = await open(lockPath, "wx").catch(() => { throw new Error("PUBLICATION_LOCKED_CHECK_EXISTING_PROCESS"); });
  try {
    const token = process.env.GITHUB_STUDIO_TOKEN || execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    let issue;
    let manifest;
    if (values.rollback) {
      if (!/^rel_\d{8}_[0-9a-f]{24}$/.test(values.rollback)) throw new Error("ROLLBACK_ID_INVALID");
      const response = await fetch(`https://api.github.com/repos/Yonge6/xiazi-global-hot-topics/contents/data/releases/${values.rollback}.json`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw+json" }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error("ROLLBACK_RELEASE_NOT_FOUND");
      ({ issue, manifest } = await response.json());
      issue = parseIssue(issue);
    } else if (values["adopt-manifest"] && values["adopt-issue"]) {
      issue = parseIssue(JSON.parse(await readFile(values["adopt-issue"], "utf8")));
      manifest = JSON.parse(await readFile(values["adopt-manifest"], "utf8"));
    } else {
      if (!values["issue-spec"] || !values["poster-root"]) throw new Error("USE --issue-spec PATH --poster-root PATH");
      const spec = JSON.parse(await readFile(values["issue-spec"], "utf8"));
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      if (spec.issueDate !== today) throw new Error("DAILY_ISSUE_MUST_BE_TODAY");
      console.log("PREFLIGHT_START");
      const report = await runPreflight(values["issue-spec"], root);
      await save(path.join(root, "preflight.json"), report);
      if (!report.ok) throw new Error(`PREFLIGHT_FAILED:${JSON.stringify(report.failures)}`);
      issue = buildDailyIssue(spec);
      const uploads = [];
      for (const topic of issue.topics) for (const locale of ["zh", "en"] as const) {
        const content = await readFile(path.join(root, locale, `NO.${String(topic.rank).padStart(2, "0")}.png`));
        await sharp(content).raw().toBuffer();
        uploads.push({ topicId: topic.id, locale, content });
      }
      const contentKey = digest(JSON.stringify({ issue, images: uploads.map((p) => ({ topicId: p.topicId, locale: p.locale, hash: digest(p.content) })) }));
      const assetBatchId = `asset_prod_${issue.issueDate.replaceAll("-", "")}_${contentKey.slice(0, 24)}`;
      manifest = { schemaVersion: "xiazi-current-release-v1", issueDate: issue.issueDate,
        releaseId: `rel_${issue.issueDate.replaceAll("-", "")}_${contentKey.slice(0, 24)}`, assetBatchId,
        posters: uploads.map((p) => ({ topicId: p.topicId, locale: p.locale, contentHash: digest(p.content),
          url: `${COS_ORIGIN}/release-assets/${assetBatchId}/${p.locale}/${issue.topics.find((t) => t.id === p.topicId)!.slug}.png` })) };
      assertReleaseBundle(issue, manifest);
      await save(path.join(root, "candidate-issue.json"), { ...issue, assetVersion: manifest.releaseId });
      await save(path.join(root, "candidate-release.json"), manifest);
      if (values["dry-run"]) { console.log("DRY_RUN_OK:18 posters; no remote writes"); return; }
      await credentials();
      const proof = await uploadImmutableReleasePosters(issue, assetBatchId, uploads, {
        uploaderVersion: "xiazi-daily-direct-v1", onProgress: (p) => console.log(`COS ${p.completed}/18 ${p.created ? "created" : "reused"}`),
      });
      await save(path.join(root, "upload-proof.json"), proof);
    }
    assertReleaseBundle(issue, manifest);
    if (values["dry-run"]) { console.log("DRY_RUN_OK:bundle valid; no remote writes"); return; }
    const publication = await publishCurrentReleaseBundle({ issue, manifest, token, rollback: Boolean(values.rollback) });
    await save(path.join(root, "publication.json"), publication);
    console.log(`ACTIVATED ${publication.releaseId} idempotent=${publication.idempotent}`);
    // Bounded cache convergence. Retrying acceptance never uploads or republishes.
    let acceptance;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { acceptance = await liveAcceptance(issue, manifest); break; }
      catch (error) { if (attempt === 2) throw error; console.log("WAITING_FOR_PUBLIC_CACHE"); await new Promise((r) => setTimeout(r, 30000)); }
    }
    await save(path.join(root, "acceptance.json"), acceptance);
    console.log(`ARCHIVE_ACCEPTED current=18/18 archive=18/18 ${site}`);
  } finally { await lock.close(); await unlink(lockPath); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(error instanceof Error ? error.message : "DAILY_PUBLICATION_FAILED"); process.exitCode = 1;
});
