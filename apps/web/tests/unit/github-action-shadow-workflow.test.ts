import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("GitHub Action shadow bridge workflow", () => {
  it("only reacts to current issue JSON changes and does not write GitHub", async () => {
    const workflow = await readFile(
      path.resolve(__dirname, "../../../../.github/workflows/sync-published-issue-shadow.yml"),
      "utf8",
    );

    expect(workflow).toContain("data/current-issue.json");
    expect(workflow).not.toContain("data/archive/**");
    expect(workflow).not.toContain("public/posters");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("scripts/sync-github-publish-to-shadow.ts");
    expect(workflow).toContain("secrets.SUPABASE_SECRET_KEY");
  });
});
