import { describe, expect, it } from "vitest";

import { imageContentType, posterVersion } from "@/lib/posters/image-bytes";

describe("poster image bytes", () => {
  it("keeps uploaded poster version tied to original bytes", () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB", "base64");
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);

    expect(imageContentType(png)).toBe("image/png");
    expect(imageContentType(jpg)).toBe("image/jpeg");
    expect(posterVersion(png)).toHaveLength(16);
    expect(posterVersion(png)).not.toBe(posterVersion(jpg));
  });
});
