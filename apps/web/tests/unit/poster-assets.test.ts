import { describe, expect, it } from "vitest";

import { DEFAULT_POSTER_ASSET, getPosterAsset } from "@/lib/posters/assets";

describe("poster assets", () => {
  it("keeps a same-origin default poster for slow or failed image loads", () => {
    expect(DEFAULT_POSTER_ASSET).toBe("/posters/default-poster.jpg");
  });

  it("serves current thumbnails through the same-domain poster cache", () => {
    expect(getPosterAsset("world-cup-global-stage", "zh", "thumbnail", "abc123"))
      .toBe("/api/posters/zh/world-cup/?variant=thumbnail&v=abc123");
  });

  it("serves current originals lazily through the same-domain poster cache", () => {
    expect(getPosterAsset("world-cup-global-stage", "en", "original", "abc123"))
      .toBe("/api/posters/en/world-cup/?v=abc123");
  });
});
