import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { resolvePosterName } from "@/lib/posters/assets";
import { parseIssue } from "@xiazi/contracts";

const mocks = vi.hoisted(() => ({
  loadPublicationByReleaseId: vi.fn(),
  loadVerifiedPoster: vi.fn(),
  loadCurrentProductionReleaseManifest: vi.fn(),
  loadLatestProductionIssue: vi.fn(),
  releaseV2Enabled: true,
}));

vi.mock("@/server/releases/release-runtime", () => ({ releaseV2Enabled: () => mocks.releaseV2Enabled }));
vi.mock("@/server/releases/release-service", () => ({
  loadPublicationByReleaseId: mocks.loadPublicationByReleaseId,
  loadVerifiedPoster: mocks.loadVerifiedPoster,
}));
vi.mock("@/server/json/production-json-source", () => ({
  loadCurrentProductionReleaseManifest: mocks.loadCurrentProductionReleaseManifest,
  loadLatestProductionIssue: mocks.loadLatestProductionIssue,
}));

import { GET } from "@/app/api/posters/[locale]/[name]/route";

const releaseId = "rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa";
const issue = parseIssue({
  ...structuredClone(currentIssue),
  issueDate: "2026-07-19",
  slug: "2026-07-19",
  beijingTimestamp: "2026-07-19T05:00:00+08:00",
  gmtTimestamp: "2026-07-18T21:00:00Z",
});
const posterName = resolvePosterName(issue.topics[0].slug);

function request(query = `?v=${releaseId}`) {
  return GET(
    new Request(`https://xiazishuo.com/api/posters/zh/${posterName}/${query}`),
    { params: Promise.resolve({ locale: "zh", name: posterName }) },
  );
}

describe("release-bound poster delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.releaseV2Enabled = true;
    mocks.loadPublicationByReleaseId.mockResolvedValue({
      issue,
      metadata: { releaseId },
    });
    mocks.loadVerifiedPoster.mockResolvedValue({
      url: `https://assets.example.com/releases/${releaseId}/zh/overview.png`,
      contentHash: "b".repeat(64),
    });
    mocks.loadLatestProductionIssue.mockResolvedValue({ issue, source: "github" });
    mocks.loadCurrentProductionReleaseManifest.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("redirects only to the immutable poster verified for the requested release", async () => {
    const response = await request();
    expect(response.status).toBe(307);
    expect(response.headers.get("x-xiazi-release-id")).toBe(releaseId);
    expect(response.headers.get("x-xiazi-content-hash")).toBe("b".repeat(64));
    expect(response.headers.get("location")).toBe(
      `https://assets.example.com/releases/${releaseId}/zh/overview.png?contentHash=${"b".repeat(64)}`,
    );
    expect(mocks.loadVerifiedPoster).toHaveBeenCalledWith(releaseId, issue.topics[0].id, "zh");
  });

  it("rejects a mutable current-style request without releaseId", async () => {
    const response = await request("");
    expect(response.status).toBe(409);
    expect(mocks.loadPublicationByReleaseId).not.toHaveBeenCalled();
  });

  it("does not fall back to legacy posters when the release store fails", async () => {
    mocks.loadPublicationByReleaseId.mockRejectedValue(new Error("database unavailable"));
    const response = await request();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ publicationHealth: "degraded", stale: true });
  });

  it("redirects from the mainland manifest directly to the immutable COS poster", async () => {
    vi.stubEnv("XIAZI_CURRENT_RELEASE_MANIFEST_ENABLED", "true");
    mocks.releaseV2Enabled = false;
    const topic = issue.topics[0];
    const contentHash = "c".repeat(64);
    mocks.loadCurrentProductionReleaseManifest.mockResolvedValue({
      releaseId,
      assetBatchId: "asset_prod_20260719_test123",
      posters: [{
        topicId: topic.id,
        locale: "zh",
        url: `https://assets.example.com/release-assets/asset_prod_20260719_test123/zh/${resolvePosterName(topic.slug)}.png`,
        contentHash,
      }],
    });

    const response = await request();

    expect(response.status).toBe(307);
    expect(response.headers.get("x-xiazi-release-id")).toBe(releaseId);
    expect(response.headers.get("location")).toContain(`contentHash=${contentHash}`);
    expect(mocks.loadPublicationByReleaseId).not.toHaveBeenCalled();
  });

  it("redirects the unchanged legacy archive through the cutoff to the CDN", async () => {
    const response = await request("?issueDate=2026-07-18&v=2026-07-18T05%3A00%3A00%2B08%3A00");

    expect(response.status).toBe(307);
    expect(mocks.loadPublicationByReleaseId).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      `https://cdn.jsdelivr.net/gh/Yonge6/xiazi-global-hot-topics@main/public/archive/2026-07-18/posters/zh/${posterName}.png?v=2026-07-18T05%3A00%3A00%2B08%3A00`,
    );
  });

  it.each(["2026-07-19", "2026-07-20", "2026-07-23"])(
    "redirects the recovered %s poster archive to the CDN",
    async (date) => {
      const response = await request(`?issueDate=${date}&v=${date}T05%3A00%3A00%2B08%3A00`);

      expect(response.status).toBe(307);
      expect(mocks.loadPublicationByReleaseId).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe(
        `https://cdn.jsdelivr.net/gh/Yonge6/xiazi-global-hot-topics@main/public/archive/${date}/posters/zh/${posterName}.png?v=${date}T05%3A00%3A00%2B08%3A00`,
      );
    },
  );

  it("still requires a releaseId for other future dated poster requests", async () => {
    const response = await request("?issueDate=2026-07-21&v=2026-07-21T05%3A00%3A00%2B08%3A00");
    expect(response.status).toBe(409);
    expect(mocks.loadPublicationByReleaseId).not.toHaveBeenCalled();
  });

  it("fails closed when the mutable current GitHub poster is unavailable", async () => {
    mocks.releaseV2Enabled = false;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("GitHub unavailable")));
    const response = await request("?v=legacy-current");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      message: "Remote poster archive unavailable",
      publicationHealth: "degraded",
      stale: true,
    });
  });
});
