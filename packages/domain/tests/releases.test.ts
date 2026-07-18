import { describe, expect, it } from "vitest";

import { assertFutureReleaseDate, publicationLeaseKey, publicationReleaseId } from "../src";

describe("future publication release identity", () => {
  const hash = "a".repeat(64);

  it("builds a stable release ID and lease key for future issues", () => {
    expect(publicationReleaseId("2026-07-19", hash)).toBe("rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(publicationLeaseKey("2026-07-19")).toBe("publication:2026-07-19");
  });

  it("hard-blocks historical remediation through Release V2", () => {
    expect(() => assertFutureReleaseDate("2026-07-18")).toThrow(/after 2026-07-18/);
    expect(() => assertFutureReleaseDate("2026-07-17")).toThrow(/after 2026-07-18/);
  });

  it("rejects non-SHA content hashes", () => {
    expect(() => publicationReleaseId("2026-07-19", "not-a-hash")).toThrow(/SHA-256/);
  });
});
