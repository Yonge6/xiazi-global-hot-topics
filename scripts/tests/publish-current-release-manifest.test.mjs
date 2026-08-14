import assert from "node:assert/strict";
import test from "node:test";

import { publishCurrentReleaseBundle } from "../publish-current-release-manifest.mjs";

const sha = (character) => character.repeat(40);
const manifest = {
  schemaVersion: "xiazi-current-release-v1",
  issueDate: "2026-08-15",
  releaseId: "rel_20260815_aaaaaaaaaaaaaaaaaaaaaaaa",
  assetBatchId: "asset_prod_20260815_example",
  posters: Array.from({ length: 18 }, (_, index) => ({ index })),
};
const issue = {
  issueDate: manifest.issueDate,
  assetVersion: manifest.issueDate,
  topics: Array.from({ length: 9 }, (_, index) => ({ id: `${index}` })),
};

function response(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return value; },
  };
}

test("publishes current issue assetVersion and release manifest in one commit", async () => {
  const calls = [];
  let blobIndex = 0;
  const result = await publishCurrentReleaseBundle({
    manifest,
    token: "test-token",
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.endsWith("/git/ref/heads/main")) return response({ object: { sha: sha("1") } });
      if (url.includes("/contents/data/current-issue.json")) {
        return response({ content: Buffer.from(JSON.stringify(issue)).toString("base64") });
      }
      if (url.endsWith(`/git/commits/${sha("1")}`)) return response({ tree: { sha: sha("2") } });
      if (url.endsWith("/git/blobs")) return response({ sha: sha(String(++blobIndex + 2)) });
      if (url.endsWith("/git/trees")) return response({ sha: sha("5") });
      if (url.endsWith("/git/commits")) return response({ sha: sha("6") });
      if (url.endsWith("/git/refs/heads/main")) return response({ object: { sha: sha("6") } });
      return response({ message: "unexpected request" }, 500);
    },
  });

  assert.equal(result.commitSha, sha("6"));
  const blobBodies = calls
    .filter((call) => call.url.endsWith("/git/blobs"))
    .map((call) => JSON.parse(call.init.body).content);
  assert.equal(blobBodies.length, 2);
  assert.equal(JSON.parse(blobBodies[0]).assetVersion, manifest.releaseId);
  assert.deepEqual(JSON.parse(blobBodies[1]), manifest);

  const treeCall = calls.find((call) => call.url.endsWith("/git/trees"));
  const tree = JSON.parse(treeCall.init.body);
  assert.deepEqual(tree.tree.map((entry) => entry.path), [
    "data/current-issue.json",
    "data/current-release.json",
  ]);
  assert.equal(calls.filter((call) => call.url.includes("/contents/") && call.init.method === "PUT").length, 0);
  const refUpdate = calls.find((call) => call.url.endsWith("/git/refs/heads/main"));
  assert.deepEqual(JSON.parse(refUpdate.init.body), { sha: sha("6"), force: false });
});

test("refuses to publish a manifest for a different current issue", async () => {
  await assert.rejects(() => publishCurrentReleaseBundle({
    manifest,
    token: "test-token",
    fetchImpl: async (url) => {
      if (url.endsWith("/git/ref/heads/main")) return response({ object: { sha: sha("1") } });
      return response({
        content: Buffer.from(JSON.stringify({ ...issue, issueDate: "2026-08-14" })).toString("base64"),
      });
    },
  }), /CURRENT_ISSUE_RELEASE_MISMATCH/);
});
