import { afterEach, describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { resolvePosterName } from "@/lib/posters/assets";
import {
  loadCurrentProductionReleaseManifest,
  loadLatestProductionIssue,
} from "@/server/json/production-json-source";
import { JsonContentRepository } from "@/server/repositories/json-content-repository";
import { parseIssue } from "@xiazi/contracts";

const issue = parseIssue(currentIssue);

describe("production JSON source", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses the same GitHub current issue source for the loader and JSON repository", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => issue,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const loaded = await loadLatestProductionIssue();
    const repositoryIssue = await new JsonContentRepository().getLatestPublishedIssue();

    expect(loaded.source).toBe("github");
    expect(loaded.issue.issueDate).toBe(issue.issueDate);
    expect(repositoryIssue.issueDate).toBe(issue.issueDate);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("contents/data/current-issue.json"),
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/vnd.github.raw+json" }),
      }),
    );
  });

  it("prefers local JSON outside production so tests do not depend on live GitHub", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const fetchMock = vi.fn(async () => {
      throw new Error("GitHub should not be called in local test mode");
    });
    vi.stubGlobal("fetch", fetchMock);

    const loaded = await loadLatestProductionIssue();

    expect(loaded.source).toBe("local");
    expect(loaded.issue.issueDate).toBe(issue.issueDate);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to packaged current JSON when GitHub returns an invalid payload", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ message: "redacted or malformed response" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const loaded = await loadLatestProductionIssue();

    expect(loaded.issue.issueDate).toBe(issue.issueDate);
    expect(["local", "github"]).toContain(loaded.source);
  });

  it("validates the small current release manifest against the current issue", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("XIAZI_CURRENT_RELEASE_MANIFEST_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_COS_BASE_URL", "https://assets.example.com");
    const assetBatchId = "asset_prod_20260810_test123";
    const manifest = {
      schemaVersion: "xiazi-current-release-v1",
      issueDate: issue.issueDate,
      releaseId: "rel_20260810_aaaaaaaaaaaaaaaaaaaaaaaa",
      assetBatchId,
      posters: issue.topics.flatMap((topic) => (["zh", "en"] as const).map((locale) => ({
        topicId: topic.id,
        locale,
        url: `https://assets.example.com/release-assets/${assetBatchId}/${locale}/${resolvePosterName(topic.slug)}.png`,
        contentHash: "b".repeat(64),
      }))),
    };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => manifest })));

    const loaded = await loadCurrentProductionReleaseManifest(issue);

    expect(loaded).toMatchObject({
      issueDate: issue.issueDate,
      releaseId: manifest.releaseId,
      assetBatchId,
    });
    expect(loaded?.posters).toHaveLength(18);
  });
});
