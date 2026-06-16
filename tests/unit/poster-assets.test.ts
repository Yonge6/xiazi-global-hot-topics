import { describe, expect, it } from "vitest";

import { DEFAULT_POSTER_ASSET, getPosterAsset } from "@/lib/posters/assets";

describe("poster assets", () => {
  it("keeps a same-origin default poster for slow or failed image loads", () => {
    expect(DEFAULT_POSTER_ASSET).toBe("/posters/default-poster.jpg");
  });

  it("serves thumbnails through the same-domain poster cache", () => {
    expect(getPosterAsset("world-cup-global-stage", "zh", "thumbnail", "abc123"))
      .toBe("/posters/thumb/zh/world-cup.webp?v=abc123");
  });

  it("serves originals lazily through the same-domain poster cache", () => {
    expect(getPosterAsset("world-cup-global-stage", "en", "original", "abc123"))
      .toBe("/posters/en/world-cup.png?v=abc123");
  });
});
