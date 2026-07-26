import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { loadArchiveIssue } from "@/features/issues/content-service";

describe("archive content service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves a nested immutable release id from the v1 issue response", async () => {
    const issue = JSON.parse(
      await readFile(new URL("../../data/archive/2026-07-25.json", import.meta.url), "utf8"),
    );
    issue.assetVersion = "rel_20260725_2073d2763efb456d75436439";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ issue }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const detail = await loadArchiveIssue("2026-07-25");

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/issues/2026-07-25/");
    expect(detail.assetVersion).toBe("rel_20260725_2073d2763efb456d75436439");
  });
});
