import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/internal/read-health/status/route";

describe("read health status route", () => {
  it("rejects unauthenticated requests without leaking internals", async () => {
    const response = await GET(new Request("https://example.com/api/internal/read-health/status"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, message: "Unauthorized" });
  });
});
