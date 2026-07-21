import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  constantTimeHexEqual,
  reviewInputHash,
  signReviewRequest,
} from "../src";

describe("review protocol cryptography", () => {
  it("hashes equivalent objects identically regardless of key order", async () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
    await expect(reviewInputHash({ b: 2, a: 1 })).resolves.toBe(await reviewInputHash({ a: 1, b: 2 }));
  });

  it("binds signatures to timestamp, nonce, method, path, and body", async () => {
    const secret = "test-review-secret-with-at-least-32-characters";
    const base = {
      timestamp: "2026-07-19T01:00:00.000Z",
      nonce: "nonce-abcdefghijklmnop",
      method: "POST",
      path: "/api/review/semantic",
      rawBody: '{"test":true}',
    };
    const signature = await signReviewRequest(secret, base);
    const changed = await signReviewRequest(secret, { ...base, rawBody: '{"test":false}' });
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(constantTimeHexEqual(signature, signature)).toBe(true);
    expect(constantTimeHexEqual(signature, changed)).toBe(false);
  });
});
