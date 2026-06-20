import { describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { contentChecksum } from "@/server/content-sync/issue-bundle";
import { syncIssueBundleToSupabase } from "@/server/content-sync/sync-issue-bundle";
import { parseIssue } from "@xiazi/contracts";

const issue = parseIssue(currentIssue);
const checksum = contentChecksum(issue);

function supabaseWithRpc(data: unknown, error: unknown = null) {
  return {
    rpc: vi.fn(async () => ({ data, error })),
  };
}

describe("content sync", () => {
  it("uses a stable execution key and maps inserted results", async () => {
    const supabase = supabaseWithRpc({ changed: true, contentVersion: 1 });
    const result = await syncIssueBundleToSupabase(supabase as never, issue, checksum, {
      actorType: "cron",
      actorId: "request-1",
    });

    expect(result.syncStatus).toBe("inserted");
    expect(result.executionKey).toBe(`shadow-sync:${issue.issueDate}:${checksum}`);
    expect(supabase.rpc).toHaveBeenCalledWith("upsert_issue_bundle_with_lock", expect.objectContaining({
      lock_key: result.executionKey,
      payload: expect.objectContaining({
        contentChecksum: checksum,
        actorType: "cron",
        actorId: "request-1",
      }),
    }));
  });

  it("maps skipped and updated idempotent results", async () => {
    await expect(syncIssueBundleToSupabase(
      supabaseWithRpc({ changed: false, contentVersion: 1 }) as never,
      issue,
      checksum,
      { actorType: "manual" },
    )).resolves.toMatchObject({ syncStatus: "skipped", changed: false, contentVersion: 1 });

    await expect(syncIssueBundleToSupabase(
      supabaseWithRpc({ changed: true, contentVersion: 2 }) as never,
      issue,
      checksum,
      { actorType: "cron" },
    )).resolves.toMatchObject({ syncStatus: "updated", changed: true, contentVersion: 2 });
  });

  it("surfaces Supabase write failures without leaking payloads", async () => {
    await expect(syncIssueBundleToSupabase(
      supabaseWithRpc(null, { message: "permission denied" }) as never,
      issue,
      checksum,
      { actorType: "cron" },
    )).rejects.toThrow("permission denied");
  });

  it("keeps repeated calls on the same checksum mapped as skipped after the first write", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { changed: true, contentVersion: 1 }, error: null })
      .mockResolvedValueOnce({ data: { changed: false, contentVersion: 1 }, error: null });
    const supabase = { rpc };

    const first = await syncIssueBundleToSupabase(supabase as never, issue, checksum, { actorType: "cron" });
    const second = await syncIssueBundleToSupabase(supabase as never, issue, checksum, { actorType: "cron" });

    expect(first.syncStatus).toBe("inserted");
    expect(second.syncStatus).toBe("skipped");
    expect(first.executionKey).toBe(second.executionKey);
  });
});
