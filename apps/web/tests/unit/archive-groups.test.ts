import { describe, expect, it } from "vitest";

import { groupArchiveDatesByMonth } from "@/lib/issues/archive-groups";

describe("groupArchiveDatesByMonth", () => {
  it("groups, deduplicates and sorts archive dates newest first", () => {
    expect(groupArchiveDatesByMonth([
      "2026-06-30",
      "2026-07-19",
      "2026-07-23",
      "2026-07-20",
      "2026-07-23",
      "invalid",
    ])).toEqual([
      { month: "2026-07", dates: ["2026-07-23", "2026-07-20", "2026-07-19"] },
      { month: "2026-06", dates: ["2026-06-30"] },
    ]);
  });
});
