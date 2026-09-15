import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";

export const COS_ORIGIN = "https://xiazi-release-v2-staging-20260719-1258992379.cos.ap-guangzhou.myqcloud.com";
export const ASSET_ORIGIN = "https://xiazi-release-assets-20260824.oss-cn-wulanchabu.aliyuncs.com";
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const equal = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

export function assertReleaseBundle(issue, manifest) {
  if (manifest?.schemaVersion !== "xiazi-current-release-v1"
    || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.issueDate || "")
    || !new RegExp(`^rel_${manifest.issueDate.replaceAll("-", "") }_[0-9a-f]{24}$`).test(manifest.releaseId || "")
    || !/^asset_[A-Za-z0-9_-]{12,80}$/.test(manifest.assetBatchId || "")
    || manifest.issueDate !== issue?.issueDate
    || !Array.isArray(issue?.topics) || issue.topics.length !== 9
    || !Array.isArray(manifest.posters) || manifest.posters.length !== 18) {
    throw new Error("CURRENT_ISSUE_RELEASE_MISMATCH");
  }
  const slots = new Set();
  if (new Set(issue.topics.map((t) => t.id)).size !== 9
    || new Set(issue.topics.map((t) => t.slug)).size !== 9) throw new Error("ISSUE_TOPICS_DUPLICATED");
  for (const poster of manifest.posters) {
    const topic = issue.topics.find((t) => t.id === poster.topicId);
    const slot = `${poster.topicId}:${poster.locale}`;
    if (!topic || !["zh", "en"].includes(poster.locale) || slots.has(slot)
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.slug)
      || !/^[0-9a-f]{64}$/.test(poster.contentHash || "")) throw new Error("CURRENT_RELEASE_POSTER_SLOT_INVALID");
    if (![COS_ORIGIN, ASSET_ORIGIN].some((origin) => poster.url === `${origin}/release-assets/${manifest.assetBatchId}/${poster.locale}/${topic.slug}.png`)) {
      throw new Error("CURRENT_RELEASE_POSTER_PATH_INVALID");
    }
    slots.add(slot);
  }
}

export async function verifyCosPosters(manifest, fetchImpl = fetch) {
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < manifest.posters.length) {
      const poster = manifest.posters[next++];
      const response = await fetchImpl(poster.url, { redirect: "error", signal: AbortSignal.timeout(120000) });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png")) throw new Error("COS_IMAGE_UNAVAILABLE");
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 10 * 1024 * 1024) throw new Error("COS_IMAGE_TOO_LARGE");
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
        || bytes.readUInt32BE(16) !== 887 || bytes.readUInt32BE(20) !== 1774
        || createHash("sha256").update(bytes).digest("hex") !== poster.contentHash) {
        throw new Error(`COS_IMAGE_HASH_OR_DIMENSIONS_INVALID:${poster.topicId}:${poster.locale}`);
      }
    }
  }));
}

export async function publishCurrentReleaseBundle({
  manifest, issue: candidateIssue, token, repo = "Yonge6/xiazi-global-hot-topics",
  fetchImpl = fetch, assetFetchImpl = fetch, rollback = false,
}) {
  if (!token) throw new Error("GITHUB_STUDIO_TOKEN is required");
  if (repo !== "Yonge6/xiazi-global-hot-topics") throw new Error("PUBLICATION_REPO_NOT_ALLOWED");
  const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`,
    "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" };
  const api = `https://api.github.com/repos/${repo}`;
  async function github(endpoint, method = "GET", body, optional = false) {
    const response = await fetchImpl(`${api}/${endpoint}`, { headers, method,
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
    if (optional && response.status === 404) return null;
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`GITHUB_${response.status}:${endpoint}`);
    return result;
  }
  const headSha = (await github("git/ref/heads/main")).object?.sha;
  if (!/^[0-9a-f]{40}$/.test(headSha || "")) throw new Error("MAIN_REF_INVALID");
  async function readJson(name, optional = false) {
    const file = await github(`contents/${name}?ref=${headSha}`, "GET", undefined, optional);
    return file ? JSON.parse(Buffer.from(file.content || "", "base64").toString("utf8")) : null;
  }
  const previousIssue = await readJson("data/current-issue.json");
  const issue = candidateIssue || previousIssue;
  assertReleaseBundle(issue, manifest);
  const synchronizedIssue = { ...issue, assetVersion: manifest.releaseId };
  if (issue.issueDate < previousIssue.issueDate && !rollback) throw new Error("OLDER_ISSUE_REQUIRES_EXPLICIT_ROLLBACK");
  const historyPath = `data/releases/${manifest.releaseId}.json`;
  const saved = await readJson(historyPath, true);
  const bundle = { issue: synchronizedIssue, manifest };
  if (saved && !equal(saved, bundle)) throw new Error("IMMUTABLE_RELEASE_ID_COLLISION");
  if (rollback && !saved) throw new Error("ROLLBACK_RELEASE_NOT_RECORDED");
  const previousManifest = await readJson("data/current-release.json", true);
  await verifyCosPosters(manifest, assetFetchImpl);
  const files = [
    ["data/current-issue.json", synchronizedIssue],
    [`data/archive/${manifest.issueDate}.json`, synchronizedIssue],
    ["data/current-release.json", manifest],
    [`data/release-archive/${manifest.issueDate}.json`, manifest],
    [historyPath, bundle],
  ];
  if (previousManifest && previousManifest.releaseId !== manifest.releaseId) {
    assertReleaseBundle(previousIssue, previousManifest);
    if (previousIssue.assetVersion !== previousManifest.releaseId) throw new Error("PREVIOUS_RELEASE_INCONSISTENT");
    const previousPath = `data/releases/${previousManifest.releaseId}.json`;
    const previousBundle = { issue: previousIssue, manifest: previousManifest };
    const recorded = await readJson(previousPath, true);
    if (recorded && !equal(recorded, previousBundle)) throw new Error("PREVIOUS_RELEASE_HISTORY_COLLISION");
    if (!recorded) files.push([previousPath, previousBundle]);
  }
  const existing = await Promise.all(files.map(([name]) => readJson(name, true)));
  const changed = files.filter(([, value], i) => !equal(value, existing[i]));
  if (!changed.length) return { issueDate: issue.issueDate, releaseId: manifest.releaseId, commitSha: headSha, idempotent: true };
  const baseTree = (await github(`git/commits/${headSha}`)).tree?.sha;
  if (!/^[0-9a-f]{40}$/.test(baseTree || "")) throw new Error("MAIN_TREE_INVALID");
  // Inline JSON only: no binary downloads, binary tree entries or local Git.
  const tree = await github("git/trees", "POST", { base_tree: baseTree,
    tree: changed.map(([name, value]) => ({ path: name, mode: "100644", type: "blob", content: json(value) })) });
  const commit = await github("git/commits", "POST", { message: `${rollback ? "Rollback" : "Publish"} daily bundle ${manifest.issueDate} ${manifest.releaseId}`,
    tree: tree.sha, parents: [headSha] });
  await github("git/refs/heads/main", "PATCH", { sha: commit.sha, force: false });
  return { issueDate: issue.issueDate, releaseId: manifest.releaseId, commitSha: commit.sha, idempotent: false, files: changed.map(([name]) => name) };
}

async function main() {
  const manifest = JSON.parse(await readFile(path.resolve(process.argv[2] || "/tmp/current-release.json"), "utf8"));
  const issue = process.argv[3] ? JSON.parse(await readFile(process.argv[3], "utf8")) : undefined;
  console.log(JSON.stringify(await publishCurrentReleaseBundle({ manifest, issue, token: process.env.GITHUB_STUDIO_TOKEN }), null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(error.message); process.exitCode = 1;
});
