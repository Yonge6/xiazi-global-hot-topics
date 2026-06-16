import { describe, expect, it } from "vitest";

import { formatDuration } from "@/lib/analytics/format";

describe("formatDuration", () => {
  it("shows a waiting state before duration data exists", () => {
    expect(formatDuration(0)).toBe("待统计");
  });

  it("formats seconds and minutes for the studio dashboard", () => {
    expect(formatDuration(42)).toBe("42秒");
    expect(formatDuration(125)).toBe("2分5秒");
    expect(formatDuration(180)).toBe("3分钟");
  });
});
