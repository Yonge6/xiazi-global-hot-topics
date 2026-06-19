import { describe, expect, it } from "vitest";

import {
  formatIssueTime,
  ISSUE_CRON_UTC,
  ISSUE_SLOT_HOURS_BEIJING,
  ISSUE_SLOT_MINUTE_BEIJING,
} from "@/lib/issues/schedule";

describe("daily issue schedule", () => {
  it("publishes at 05:00 Beijing time", () => {
    expect(ISSUE_SLOT_HOURS_BEIJING).toEqual([5]);
    expect(ISSUE_SLOT_MINUTE_BEIJING).toBe(0);
    expect(ISSUE_CRON_UTC).toBe("0 21 * * *");
  });

  it("formats the daily publication time", () => {
    const timestamp = "2026-06-15T05:00:00+08:00";

    expect(formatIssueTime(timestamp, "zh")).toContain("北京时间 2026-06-15 05:00");
    expect(formatIssueTime(timestamp, "en")).toContain("GMT · 14 Jun 2026, 21:00");
  });
});
