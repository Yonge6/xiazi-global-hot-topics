import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const manifestPath = path.resolve(process.argv[2] || "/tmp/current-release.json");

function assertManifest(manifest) {
  if (manifest.schemaVersion !== "xiazi-current-release-v1"
    || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.issueDate || "")
    || !/^rel_\d{8}_[0-9a-f]{24}$/.test(manifest.releaseId || "")
    || !/^asset_[A-Za-z0-9_-]{12,80}$/.test(manifest.assetBatchId || "")
    || !Array.isArray(manifest.posters)
    || manifest.posters.length !== 18) {
    throw new Error("CURRENT_RELEASE_MANIFEST_INVALID");
  }
}

async function githubJson(fetchImpl, url, init, label) {
  const response = await fetchImpl(url, init);
  const detail = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${label}: ${detail?.message || response.status}`);
  return detail;
}

export async function publishCurrentReleaseBundle({
  manifest,
  token,
  repo = "Yonge6/xiazi-global-hot-topics",
  fetchImpl = fetch,
}) {
  assertManifest(manifest);
  if (!token) throw new Error("GITHUB_STUDIO_TOKEN is required");

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const api = `https://api.github.com/repos/${repo}`;
  const ref = await githubJson(fetchImpl, `${api}/git/ref/heads/main`, { headers }, "main ref");
  const headSha = ref.object?.sha;
  if (!/^[0-9a-f]{40}$/.test(headSha || "")) throw new Error("MAIN_REF_INVALID");
  const issueFile = await githubJson(
    fetchImpl,
    `${api}/contents/data/current-issue.json?ref=${headSha}`,
    { headers },
    "data/current-issue.json",
  );
  const currentIssue = JSON.parse(Buffer.from(issueFile.content || "", "base64").toString("utf8"));
  if (currentIssue.issueDate !== manifest.issueDate
    || !Array.isArray(currentIssue.topics)
    || currentIssue.topics.length !== 9) {
    throw new Error("CURRENT_ISSUE_RELEASE_MISMATCH");
  }
  const synchronizedIssue = { ...currentIssue, assetVersion: manifest.releaseId };

  const archivePosters = await Promise.all(manifest.posters.map(async (poster) => {
    const topic = currentIssue.topics.find((item) => item.id === poster.topicId);
    if (!topic || (poster.locale !== "zh" && poster.locale !== "en")) {
      throw new Error("CURRENT_RELEASE_POSTER_SLOT_INVALID");
    }
    const sourcePath = `apps/web/public/posters/${poster.locale}/${topic.slug}.png`;
    const source = await githubJson(
      fetchImpl,
      `${api}/contents/${sourcePath}?ref=${headSha}`,
      { headers },
      sourcePath,
    );
    if (source.type !== "file" || !/^[0-9a-f]{40}$/.test(source.sha || "")) {
      throw new Error(`CURRENT_RELEASE_POSTER_SOURCE_INVALID:${sourcePath}`);
    }
    return {
      path: `public/archive/${manifest.issueDate}/posters/${poster.locale}/${topic.slug}.png`,
      mode: "100644",
      type: "blob",
      sha: source.sha,
    };
  }));

  const baseCommit = await githubJson(
    fetchImpl,
    `${api}/git/commits/${headSha}`,
    { headers },
    "main commit",
  );
  const baseTreeSha = baseCommit.tree?.sha;
  if (!/^[0-9a-f]{40}$/.test(baseTreeSha || "")) throw new Error("MAIN_TREE_INVALID");

  const files = [
    ["data/current-issue.json", synchronizedIssue],
    [`data/archive/${manifest.issueDate}.json`, synchronizedIssue],
    ["data/current-release.json", manifest],
  ];
  const blobs = await Promise.all(files.map(async ([pathname, value]) => {
    const blob = await githubJson(fetchImpl, `${api}/git/blobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        content: `${JSON.stringify(value, null, 2)}\n`,
        encoding: "utf-8",
      }),
    }, pathname);
    return { pathname, sha: blob.sha };
  }));
  const tree = await githubJson(fetchImpl, `${api}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [
        ...blobs.map(({ pathname, sha }) => ({
          path: pathname,
          mode: "100644",
          type: "blob",
          sha,
        })),
        ...archivePosters,
      ],
    }),
  }, "release tree");
  const commit = await githubJson(fetchImpl, `${api}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: `Publish release manifest ${manifest.issueDate}`,
      tree: tree.sha,
      parents: [headSha],
    }),
  }, "release commit");
  await githubJson(fetchImpl, `${api}/git/refs/heads/main`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ sha: commit.sha, force: false }),
  }, "main update");

  return {
    issueDate: manifest.issueDate,
    releaseId: manifest.releaseId,
    commitSha: commit.sha,
  };
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const result = await publishCurrentReleaseBundle({
    manifest,
    token: process.env.GITHUB_STUDIO_TOKEN,
    repo: process.env.GITHUB_REPOSITORY || "Yonge6/xiazi-global-hot-topics",
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
