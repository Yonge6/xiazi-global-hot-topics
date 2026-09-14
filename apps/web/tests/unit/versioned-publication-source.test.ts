import { afterEach, expect, it, vi } from "vitest";
import { parseIssue } from "@xiazi/contracts";
import currentIssue from "@/data/current-issue.json";
import { resolvePosterName } from "@/lib/posters/assets";
import { loadCurrentProductionReleaseManifest, loadProductionReleaseManifestByDate } from "@/server/json/production-json-source";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("uses the issue's immutable manifest even when current-release cache is newer", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("XIAZI_JSON_SOURCE", "github");
  vi.stubEnv("XIAZI_CURRENT_RELEASE_MANIFEST_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_COS_BASE_URL", "https://assets.example.com");
  const issue = parseIssue({ ...currentIssue, assetVersion: "rel_20260914_aaaaaaaaaaaaaaaaaaaaaaaa" });
  const assetBatchId = "asset_prod_20260914_test123";
  const manifest = { schemaVersion: "xiazi-current-release-v1", issueDate: issue.issueDate, releaseId: issue.assetVersion,
    assetBatchId, posters: issue.topics.flatMap((topic) => ["zh", "en"].map((locale) => ({ topicId: topic.id, locale,
      url: `https://assets.example.com/release-assets/${assetBatchId}/${locale}/${resolvePosterName(topic.slug)}.png`, contentHash: "a".repeat(64) }))) };
  const mock = vi.fn(async (url: string) => {
    expect(url).toContain(`data/releases/${issue.assetVersion}.json`);
    return { ok: true, json: async () => ({ issue, manifest }) };
  });
  vi.stubGlobal("fetch", mock);
  expect((await loadCurrentProductionReleaseManifest(issue))?.releaseId).toBe(issue.assetVersion);
  expect((await loadProductionReleaseManifestByDate(issue.issueDate, issue))?.releaseId).toBe(issue.assetVersion);
  expect(mock).toHaveBeenCalledTimes(2);
});
