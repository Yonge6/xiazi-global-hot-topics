import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_POSTER_ASSET, getBrandAsset, getPosterAsset } from "@/lib/posters/assets";

describe("poster assets", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_COS_BASE_URL;
    delete process.env.NEXT_PUBLIC_POSTER_API_ORIGIN;
  });

  it("keeps a same-origin default poster for slow or failed image loads", () => {
    expect(DEFAULT_POSTER_ASSET).toBe("/posters/default-poster.jpg");
  });

  it("keeps fixed brand masters on the public same-origin path", () => {
    process.env.NEXT_PUBLIC_COS_BASE_URL = "https://private-cos.example.com";
    expect(getBrandAsset("brand/logo/xiazi-global-hot-topics.webp"))
      .toBe("/brand/logo/xiazi-global-hot-topics.webp");
  });

  it("serves current thumbnails through the same-domain poster cache", () => {
    expect(getPosterAsset("world-cup-global-stage", "zh", "thumbnail", "abc123"))
      .toBe("/api/posters/zh/world-cup/?variant=thumbnail&v=abc123");
  });

  it("serves current originals lazily through the same-domain poster cache", () => {
    expect(getPosterAsset("world-cup-global-stage", "en", "original", "abc123"))
      .toBe("/api/posters/en/world-cup/?v=abc123");
  });

  it("can serve poster API URLs from the production origin for static mirrors", () => {
    process.env.NEXT_PUBLIC_POSTER_API_ORIGIN = "https://xiazishuo.com/";
    expect(getPosterAsset("world-cup-global-stage", "zh", "thumbnail", "abc123"))
      .toBe("https://xiazishuo.com/api/posters/zh/world-cup/?variant=thumbnail&v=abc123");
  });
});
