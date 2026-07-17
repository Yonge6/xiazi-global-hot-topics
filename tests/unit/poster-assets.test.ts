import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_POSTER_ASSET, getCosAsset, getPosterAsset } from "@/lib/posters/assets";

describe("poster assets", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps a same-origin default poster for slow or failed image loads", () => {
    expect(DEFAULT_POSTER_ASSET).toBe("/posters/default-poster.jpg");
  });

  it("serves thumbnails through the dynamic poster endpoint", () => {
    expect(getPosterAsset("world-cup-global-stage", "zh", "thumbnail", "abc123"))
      .toBe("/api/posters/zh/world-cup/?variant=thumbnail&v=abc123");
  });

  it("serves originals through the dynamic poster endpoint", () => {
    expect(getPosterAsset("world-cup-global-stage", "en", "original", "abc123"))
      .toBe("/api/posters/en/world-cup/?v=abc123");
  });

  it("uses a valid public asset origin", () => {
    vi.stubEnv("NEXT_PUBLIC_COS_BASE_URL", "https://assets.example.com/");
    expect(getCosAsset("brand/logo.webp")).toBe("https://assets.example.com/brand/logo.webp");
  });

  it("falls back to same-origin assets when a build-time secret placeholder is injected", () => {
    vi.stubEnv("NEXT_PUBLIC_COS_BASE_URL", "[SENSITIVE]");
    expect(getCosAsset("brand/logo.webp")).toBe("/brand/logo.webp");
  });
});
