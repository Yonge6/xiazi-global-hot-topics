import { describe, expect, it } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { parseIssue } from "@xiazi/contracts";
import { contentChecksum, stableJson, validateIssueForImport } from "../../../../scripts/content/issues";

const parsedCurrentIssue = parseIssue(currentIssue);

describe("content importer validation", () => {
  it("accepts the current issue contract", () => {
    const { issue } = validateIssueForImport(currentIssue);
    expect(issue.topics).toHaveLength(9);
  });

  it("rejects duplicate ranks", () => {
    const broken = structuredClone(currentIssue);
    broken.topics[1].rank = broken.topics[0].rank;
    expect(() => validateIssueForImport(broken)).toThrow(/ranks must be exactly 1-9/);
  });

  it("rejects invalid source URLs through the contract", () => {
    const broken = structuredClone(currentIssue);
    broken.topics[0].sources[0].url = "javascript:alert(1)";
    expect(() => validateIssueForImport(broken)).toThrow();
  });

  it("rejects mismatched Beijing and GMT timestamps", () => {
    const broken = structuredClone(currentIssue);
    broken.gmtTimestamp = "2026-06-19T21:00:00Z";
    expect(() => validateIssueForImport(broken)).toThrow(/same instant/);
  });

  it("computes stable checksums independent of object key order", () => {
    expect(stableJson({ b: 2, a: 1 })).toBe(stableJson({ a: 1, b: 2 }));
    expect(contentChecksum(parsedCurrentIssue)).toBe(contentChecksum(structuredClone(parsedCurrentIssue)));
  });
});
