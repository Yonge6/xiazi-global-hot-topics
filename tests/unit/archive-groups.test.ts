import { describe, expect, it } from "vitest";

import { groupArchiveDatesByMonth } from "../../src/lib/issues/archive-groups";

describe("groupArchiveDatesByMonth", () => {
  it("groups, deduplicates and sorts archive dates newest first", () => {
    expect(groupArchiveDatesByMonth([
      "2026-06-30",
      "2026-07-13",
      "2026-07-14",
      "2026-06-30",
      "invalid",
    ])).toEqual([
      { month: "2026-07", dates: ["2026-07-14", "2026-07-13"] },
      { month: "2026-06", dates: ["2026-06-30"] },
    ]);
  });
});
