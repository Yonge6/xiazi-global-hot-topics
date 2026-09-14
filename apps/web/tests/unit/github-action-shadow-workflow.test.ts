import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("GitHub Action shadow bridge workflow", () => {
  it("is manual maintenance only and never adds a database job to daily publication", async () => {
    const workflow = await readFile(
      path.resolve(__dirname, "../../../../.github/workflows/sync-published-issue-shadow.yml"),
      "utf8",
    );

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+push:/m);
    expect(workflow).not.toMatch(/^\s+schedule:/m);
    expect(workflow).not.toContain("data/archive/**");
    expect(workflow).not.toContain("public/posters");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("scripts/sync-github-publish-to-shadow.ts");
    expect(workflow).toContain("secrets.SUPABASE_SECRET_KEY");
  });
});
