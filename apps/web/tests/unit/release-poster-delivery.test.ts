import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { parseIssue } from "@xiazi/contracts";

const mocks = vi.hoisted(() => ({
  loadPublicationByReleaseId: vi.fn(),
  loadVerifiedPoster: vi.fn(),
  releaseV2Enabled: true,
}));

vi.mock("@/server/releases/release-runtime", () => ({ releaseV2Enabled: () => mocks.releaseV2Enabled }));
vi.mock("@/server/releases/release-service", () => ({
  loadPublicationByReleaseId: mocks.loadPublicationByReleaseId,
  loadVerifiedPoster: mocks.loadVerifiedPoster,
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

function request(query = `?v=${releaseId}`) {
  return GET(
    new Request(`https://xiazishuo.com/api/posters/zh/overview/${query}`),
    { params: Promise.resolve({ locale: "zh", name: "overview" }) },
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("serves the unchanged legacy GitHub archive through the cutoff when Release V2 is enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await request("?issueDate=2026-07-18&v=2026-07-18T05%3A00%3A00%2B08%3A00");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(mocks.loadPublicationByReleaseId).not.toHaveBeenCalled();
    const requestedUrl = fetchMock.mock.calls[0]?.[0] as URL;
    expect(requestedUrl.pathname).toBe(
      "/Yonge6/xiazi-global-hot-topics/main/public/archive/2026-07-18/posters/zh/overview.png",
    );
  });

  it("still requires a releaseId for future dated poster requests", async () => {
    const response = await request("?issueDate=2026-07-19&v=2026-07-19T05%3A00%3A00%2B08%3A00");
    expect(response.status).toBe(409);
    expect(mocks.loadPublicationByReleaseId).not.toHaveBeenCalled();
  });

  it("fails closed when the remote legacy GitHub archive is unavailable", async () => {
    mocks.releaseV2Enabled = false;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("GitHub unavailable")));
    const response = await request("?issueDate=2026-07-18&v=legacy-archive");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      message: "Remote poster archive unavailable",
      publicationHealth: "degraded",
      stale: true,
    });
  });
});
