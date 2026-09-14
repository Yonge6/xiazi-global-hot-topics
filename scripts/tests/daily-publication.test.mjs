import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { assertReleaseBundle, COS_ORIGIN, publishCurrentReleaseBundle } from "../publish-current-release-manifest.mjs";

const image = Buffer.alloc(24);
Buffer.from("89504e470d0a1a0a", "hex").copy(image);
image.writeUInt32BE(887, 16); image.writeUInt32BE(1774, 20);
const hash = createHash("sha256").update(image).digest("hex");
const issue = { issueDate: "2026-09-14", topics: Array.from({ length: 9 }, (_, i) => ({ id: `id-${i}`, slug: `topic-${i}` })) };
const manifest = { schemaVersion: "xiazi-current-release-v1", issueDate: issue.issueDate,
  releaseId: "rel_20260914_aaaaaaaaaaaaaaaaaaaaaaaa", assetBatchId: "asset_prod_20260914_example",
  posters: issue.topics.flatMap((topic) => ["zh", "en"].map((locale) => ({ topicId: topic.id, locale, contentHash: hash,
    url: `${COS_ORIGIN}/release-assets/asset_prod_20260914_example/${locale}/${topic.slug}.png` }))) };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
function fixture(overrides = {}) {
  const calls = [];
  const files = { "data/current-issue.json": issue, ...overrides };
  return { calls, files, options: { issue, manifest, token: "test-token",
    assetFetchImpl: async () => new Response(image, { headers: { "content-type": "image/png" } }),
    fetchImpl: async (url, init) => {
      calls.push({ url, ...init });
      if (url.endsWith("/git/ref/heads/main")) return reply({ object: { sha: "1".repeat(40) } });
      if (url.includes("/contents/")) {
        assert.match(url, /\?ref=1{40}$/);
        const name = url.split("/contents/")[1].split("?")[0];
        return files[name] ? reply({ content: Buffer.from(JSON.stringify(files[name])).toString("base64") }) : reply({}, 404);
      }
      if (url.endsWith(`/git/commits/${"1".repeat(40)}`)) return reply({ tree: { sha: "2".repeat(40) } });
      if (url.endsWith("/git/trees")) return reply({ sha: "3".repeat(40) });
      if (url.endsWith("/git/commits")) return reply({ sha: "4".repeat(40) });
      if (url.endsWith("/git/refs/heads/main")) return reply({});
      throw new Error(`Unexpected ${url}`);
    } } };
}

test("one JSON-only commit contains current, dated archives and immutable history", async () => {
  const f = fixture();
  const result = await publishCurrentReleaseBundle(f.options);
  assert.equal(result.idempotent, false);
  const tree = JSON.parse(f.calls.find((c) => c.url.endsWith("/git/trees")).body).tree;
  assert.equal(tree.length, 5);
  assert.ok(tree.every((entry) => entry.path.endsWith(".json") && entry.content && !entry.sha));
  assert.deepEqual(tree.slice(0, 4).map((entry) => entry.path), ["data/current-issue.json", "data/archive/2026-09-14.json", "data/current-release.json", "data/release-archive/2026-09-14.json"]);
  assert.equal(JSON.parse(tree[0].content).assetVersion, manifest.releaseId);
  assert.ok(!f.calls.some((c) => c.url.includes("public/posters")));
  assert.equal(JSON.parse(f.calls.at(-1).body).force, false);
});

test("complete rerun is idempotent and creates no commit", async () => {
  const synchronized = { ...issue, assetVersion: manifest.releaseId };
  const f = fixture({ "data/current-issue.json": synchronized, "data/archive/2026-09-14.json": synchronized,
    "data/current-release.json": manifest, "data/release-archive/2026-09-14.json": manifest,
    [`data/releases/${manifest.releaseId}.json`]: { issue: synchronized, manifest } });
  assert.equal((await publishCurrentReleaseBundle(f.options)).idempotent, true);
  assert.ok(f.calls.every((c) => c.method === "GET"));
});

test("invalid slot, missing image, bad hash and foreign COS origin fail closed", async () => {
  for (const mutate of [
    (m) => m.posters.pop(), (m) => m.posters[1] = m.posters[0],
    (m) => m.posters[0].contentHash = "bad", (m) => m.posters[0].url = "https://evil.example/image.png",
  ]) {
    const copy = structuredClone(manifest); mutate(copy);
    assert.throws(() => assertReleaseBundle(issue, copy));
  }
  const f = fixture();
  await assert.rejects(publishCurrentReleaseBundle({ ...f.options, assetFetchImpl: async () => new Response("bad", { headers: { "content-type": "image/png" } }) }), /COS_IMAGE_HASH/);
  assert.ok(f.calls.every((c) => c.method === "GET"));
});

test("same release ID cannot replace its recorded content", async () => {
  const f = fixture({ [`data/releases/${manifest.releaseId}.json`]: { issue: { changed: true }, manifest } });
  await assert.rejects(publishCurrentReleaseBundle(f.options), /IMMUTABLE_RELEASE_ID_COLLISION/);
});

test("older publication and unrecorded rollback are rejected", async () => {
  const f = fixture({ "data/current-issue.json": { ...issue, issueDate: "2026-09-15" } });
  await assert.rejects(publishCurrentReleaseBundle(f.options), /OLDER_ISSUE/);
  await assert.rejects(publishCurrentReleaseBundle({ ...f.options, rollback: true }), /ROLLBACK_RELEASE_NOT_RECORDED/);
});

test("concurrent main change never forces a push", async () => {
  const f = fixture();
  const original = f.options.fetchImpl;
  await assert.rejects(publishCurrentReleaseBundle({ ...f.options, fetchImpl: async (url, init) =>
    url.endsWith("/git/refs/heads/main") ? reply({}, 422) : original(url, init) }), /GITHUB_422/);
});

test("explicit rollback restores a recorded older bundle and preserves the newer release", async () => {
  const nextManifest = { ...manifest, issueDate: "2026-09-15", releaseId: "rel_20260915_bbbbbbbbbbbbbbbbbbbbbbbb" };
  const nextIssue = { ...issue, issueDate: "2026-09-15", assetVersion: nextManifest.releaseId };
  const savedIssue = { ...issue, assetVersion: manifest.releaseId };
  const f = fixture({ "data/current-issue.json": nextIssue, "data/current-release.json": nextManifest,
    [`data/releases/${manifest.releaseId}.json`]: { issue: savedIssue, manifest } });
  const result = await publishCurrentReleaseBundle({ ...f.options, rollback: true });
  assert.equal(result.releaseId, manifest.releaseId);
  const tree = JSON.parse(f.calls.find((c) => c.url.endsWith("/git/trees")).body).tree;
  expectPreserved(tree);
  function expectPreserved(entries) {
    assert.ok(entries.some((entry) => entry.path === `data/releases/${nextManifest.releaseId}.json`));
    assert.ok(!entries.some((entry) => entry.path === "data/archive/2026-09-15.json"));
  }
});

test("superseded same-day release is preserved before replacement", async () => {
  const previous = { ...manifest, releaseId: "rel_20260914_bbbbbbbbbbbbbbbbbbbbbbbb" };
  const oldIssue = { ...issue, assetVersion: previous.releaseId };
  const f = fixture({ "data/current-issue.json": oldIssue, "data/current-release.json": previous });
  await publishCurrentReleaseBundle(f.options);
  const tree = JSON.parse(f.calls.find((c) => c.url.endsWith("/git/trees")).body).tree;
  const saved = tree.find((entry) => entry.path === `data/releases/${previous.releaseId}.json`);
  assert.deepEqual(JSON.parse(saved.content), { issue: oldIssue, manifest: previous });
});
