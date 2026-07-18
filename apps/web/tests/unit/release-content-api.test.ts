import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { parseIssue } from "@xiazi/contracts";

const mocks = vi.hoisted(() => ({
  loadActivePublication: vi.fn(),
  loadLatestProductionIssue: vi.fn(),
}));

vi.mock("@/server/releases/release-service", () => ({
  loadActivePublication: mocks.loadActivePublication,
}));

vi.mock("@/server/json/production-json-source", () => ({
  loadLatestProductionIssue: mocks.loadLatestProductionIssue,
}));

import { GET } from "@/app/api/content/route";

const issue = parseIssue(currentIssue);

describe("release-aware content API", () => {
  beforeEach(() => {
    vi.stubEnv("RELEASE_V2_ENABLED", "true");
    vi.stubEnv("RELEASE_EXPLICIT_DEGRADED_FALLBACK", "false");
    mocks.loadActivePublication.mockResolvedValue({
      issue,
      metadata: {
        releaseId: "rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa",
        contentHash: "a".repeat(64),
        dataSource: "supabase-release",
        deployedAt: "2026-07-19T00:40:00.000Z",
        publicationHealth: "healthy",
        stale: false,
      },
    });
    mocks.loadLatestProductionIssue.mockResolvedValue({ issue, source: "github" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns release identity and version proof for a healthy active release", async () => {
    const response = await GET();
    const detail = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-publication-health")).toBe("healthy");
    expect(response.headers.get("x-release-id")).toBe(detail.releaseId);
    expect(detail).toMatchObject({
      releaseId: "rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa",
      contentHash: "a".repeat(64),
      dataSource: "supabase-release",
      publicationHealth: "healthy",
      stale: false,
    });
  });

  it("returns 503 instead of silently serving stale JSON", async () => {
    mocks.loadActivePublication.mockRejectedValue(new Error("database unavailable"));
    const response = await GET();
    const detail = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("x-content-stale")).toBe("true");
    expect(detail).toMatchObject({ publicationHealth: "degraded", stale: true });
    expect(mocks.loadLatestProductionIssue).not.toHaveBeenCalled();
  });

  it("marks an explicitly enabled emergency fallback as degraded and stale", async () => {
    vi.stubEnv("RELEASE_EXPLICIT_DEGRADED_FALLBACK", "true");
    mocks.loadActivePublication.mockRejectedValue(new Error("database unavailable"));
    const response = await GET();
    const detail = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-publication-health")).toBe("degraded");
    expect(response.headers.get("x-content-stale")).toBe("true");
    expect(detail.dataSource).toBe("github");
    expect(detail.stale).toBe(true);
    expect(detail.degradationReason).toContain("database unavailable");
  });
});
