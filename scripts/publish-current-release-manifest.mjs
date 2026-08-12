import { readFile } from "node:fs/promises";
import path from "node:path";

const manifestPath = path.resolve(process.argv[2] || "/tmp/current-release.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const token = process.env.GITHUB_STUDIO_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || "Yonge6/xiazi-global-hot-topics";
const pathname = "data/current-release.json";

if (!token) throw new Error("GITHUB_STUDIO_TOKEN is required");
if (manifest.schemaVersion !== "xiazi-current-release-v1"
  || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.issueDate || "")
  || !/^rel_\d{8}_[0-9a-f]{24}$/.test(manifest.releaseId || "")
  || !/^asset_[A-Za-z0-9_-]{12,80}$/.test(manifest.assetBatchId || "")
  || !Array.isArray(manifest.posters)
  || manifest.posters.length !== 18) {
  throw new Error("CURRENT_RELEASE_MANIFEST_INVALID");
}

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
};
const current = await fetch(`https://api.github.com/repos/${repo}/contents/${pathname}?ref=main`, { headers });
const existing = current.status === 404 ? null : await current.json();
if (!current.ok && current.status !== 404) {
  throw new Error(`${pathname}: ${existing?.message || current.status}`);
}
const response = await fetch(`https://api.github.com/repos/${repo}/contents/${pathname}`, {
  method: "PUT",
  headers,
  body: JSON.stringify({
    message: `Publish release manifest ${manifest.issueDate}`,
    branch: "main",
    content: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8").toString("base64"),
    ...(existing?.sha ? { sha: existing.sha } : {}),
  }),
});
const detail = await response.json().catch(() => null);
if (!response.ok) throw new Error(`${pathname}: ${detail?.message || response.status}`);
console.log(JSON.stringify({
  issueDate: manifest.issueDate,
  releaseId: manifest.releaseId,
  commitSha: detail.commit?.sha,
}, null, 2));
