import { describe, expect, it } from "vitest";

import {
  assertFutureReleaseDate,
  PUBLICATION_RELEASE_SCHEMA_VERSION,
  publicationLeaseKey,
  publicationReleaseId,
} from "../src";

describe("future publication release identity", () => {
  const hash = "a".repeat(64);

  it("builds a stable release ID from the complete release hash", () => {
    expect(publicationReleaseId("2026-07-19", hash)).toBe("rel_20260719_aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(publicationLeaseKey("2026-07-19")).toBe("publication:2026-07-19");
    expect(PUBLICATION_RELEASE_SCHEMA_VERSION).toBe("release-v2.1");
  });

  it("hard-blocks historical remediation through Release V2", () => {
    expect(() => assertFutureReleaseDate("2026-07-18")).toThrow(/after 2026-07-18/);
    expect(() => assertFutureReleaseDate("2026-07-17")).toThrow(/after 2026-07-18/);
  });

  it("rejects non-SHA release hashes", () => {
    expect(() => publicationReleaseId("2026-07-19", "not-a-hash")).toThrow(/SHA-256/);
  });
});
