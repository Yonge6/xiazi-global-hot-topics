import { afterEach, describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { loadLatestProductionIssue } from "@/server/json/production-json-source";
import { JsonContentRepository } from "@/server/repositories/json-content-repository";
import { parseIssue } from "@xiazi/contracts";

const issue = parseIssue(currentIssue);

describe("production JSON source", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses the same GitHub current issue source for the loader and JSON repository", async () => {
    vi.stubEnv("XIAZI_JSON_SOURCE", "github");
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
});
