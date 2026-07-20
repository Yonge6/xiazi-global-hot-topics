import { describe, expect, it, vi } from "vitest";

import { SupabaseReplayStore } from "@/server/replay-store";

describe("Supabase replay store", () => {
  it("hashes the nonce and reserves it through the atomic RPC", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("true", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const store = new SupabaseReplayStore("https://staging-project.supabase.co", "service-role-test-key");

    await expect(store.reserve("one-time-nonce", 600)).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://staging-project.supabase.co/rest/v1/rpc/reserve_review_request_nonce");
    expect(init?.redirect).toBe("error");
    expect(init?.headers).toMatchObject({
      apikey: "service-role-test-key",
      Authorization: "Bearer service-role-test-key",
    });
    const body = JSON.parse(String(init?.body));
    expect(body.p_nonce_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.p_nonce_hash).not.toContain("one-time-nonce");
    expect(body.p_ttl_seconds).toBe(600);
  });

  it("fails closed when the durable store is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    const store = new SupabaseReplayStore("https://staging-project.supabase.co", "service-role-test-key");
    await expect(store.reserve("one-time-nonce", 600)).rejects.toThrow("REVIEW_REPLAY_STORE_FAILED:503");
  });
});
