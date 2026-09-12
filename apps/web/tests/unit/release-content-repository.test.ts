import { beforeEach, describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { parseIssue } from "@xiazi/contracts";

const mocks = vi.hoisted(() => ({
  listPublishedPublications: vi.fn(),
  loadPublicationByDate: vi.fn(),
  listProductionArchiveIssues: vi.fn(),
  loadProductionIssueByDate: vi.fn(),
}));

vi.mock("@/server/releases/release-service", () => ({
  listPublishedPublications: mocks.listPublishedPublications,
  loadActivePublication: vi.fn(),
  loadPublicationByDate: mocks.loadPublicationByDate,
}));

vi.mock("@/server/json/production-json-source", () => ({
  listProductionArchiveIssues: mocks.listProductionArchiveIssues,
  loadLatestProductionIssue: vi.fn(),
  loadProductionIssueByDate: mocks.loadProductionIssueByDate,
}));

import { ReleaseContentRepository } from "@/server/releases/release-content-repository";

function issueFor(date: string) {
  return parseIssue({
    ...structuredClone(currentIssue),
    id: `issue-${date}`,
    slug: date,
    issueDate: date,
    beijingTimestamp: `${date}T05:00:00+08:00`,
    gmtTimestamp: `${date}T00:00:00Z`,
  });
}

describe("ReleaseContentRepository archive recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPublishedPublications.mockResolvedValue([
      { issue: issueFor("2026-07-26") },
      { issue: issueFor("2026-07-22") },
      { issue: issueFor("2026-07-21") },
    ]);
    mocks.listProductionArchiveIssues.mockResolvedValue([
      { issueDate: "2026-07-25", slug: "2026-07-25", status: "published", source: "github" },
      { issueDate: "2026-07-23", slug: "2026-07-23", status: "published", source: "github" },
      { issueDate: "2026-07-22", slug: "2026-07-22", status: "published", source: "github" },
      { issueDate: "2026-07-20", slug: "2026-07-20", status: "published", source: "github" },
      { issueDate: "2026-07-19", slug: "2026-07-19", status: "published", source: "github" },
      { issueDate: "2026-07-18", slug: "2026-07-18", status: "published", source: "github" },
    ]);
  });

  it("merges GitHub fallback archives with Release V2 publications and deduplicates dates", async () => {
    const issues = await new ReleaseContentRepository().listPublishedIssues();

    expect(issues.map((issue) => issue.issueDate)).toEqual([
      "2026-07-26",
      "2026-07-25",
      "2026-07-23",
      "2026-07-22",
      "2026-07-21",
      "2026-07-20",
      "2026-07-19",
      "2026-07-18",
    ]);
    expect(issues.find((issue) => issue.issueDate === "2026-07-22")?.source).toBe("supabase-release");
  });

  it("falls back to a GitHub archive when a Release V2 row is missing", async () => {
    const repository = new ReleaseContentRepository();
    mocks.loadProductionIssueByDate.mockImplementation(async (date) => ({ issue: issueFor(date), source: "github" }));
    mocks.loadPublicationByDate.mockImplementation(async (date) => {
      if (date === "2026-07-22") return { issue: issueFor(date) };
      throw new Error("release store unavailable");
    });

    await expect(repository.getIssueByDate("2026-07-23")).resolves.toMatchObject({ issueDate: "2026-07-23" });
    await expect(repository.getIssueByDate("2026-07-22")).resolves.toMatchObject({ issueDate: "2026-07-22" });
    await expect(repository.getIssueByDate("2026-07-25")).resolves.toMatchObject({ issueDate: "2026-07-25" });
    expect(mocks.loadProductionIssueByDate).toHaveBeenCalledWith("2026-07-23");
    expect(mocks.loadProductionIssueByDate).toHaveBeenCalledWith("2026-07-25");
    expect(mocks.loadPublicationByDate).toHaveBeenCalledWith("2026-07-22");
    expect(mocks.loadPublicationByDate).toHaveBeenCalledWith("2026-07-25");
  });

  it("still lists GitHub archives when the Release V2 store is unavailable", async () => {
    mocks.listPublishedPublications.mockRejectedValue(new Error("release store unavailable"));

    const issues = await new ReleaseContentRepository().listPublishedIssues();

    expect(issues.map((issue) => issue.issueDate)).toEqual([
      "2026-07-25",
      "2026-07-23",
      "2026-07-22",
      "2026-07-20",
      "2026-07-19",
      "2026-07-18",
    ]);
  });
});
