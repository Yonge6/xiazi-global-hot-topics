import { beforeEach, describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { contentChecksum } from "@/server/content-sync/issue-bundle";
import { completeShadowPublishAfterPrimary } from "@/server/publishing/complete-shadow-publish-after-primary";
import { parseIssue } from "@xiazi/contracts";

const mocks = vi.hoisted(() => ({
  serviceClient: {},
  publishSupabaseShadow: vi.fn(),
  startPublishRun: vi.fn(),
  updatePublishRun: vi.fn(),
}));

vi.mock("@/server/content-sync/supabase-service-client", () => ({
  createSupabaseServiceClientFromEnv: () => mocks.serviceClient,
}));

vi.mock("@/server/publishing/publish-supabase-shadow", async () => {
  const actual = await vi.importActual<typeof import("@/server/publishing/publish-supabase-shadow")>(
    "@/server/publishing/publish-supabase-shadow",
  );
  return {
    ...actual,
    publishSupabaseShadow: mocks.publishSupabaseShadow,
  };
});

vi.mock("@/server/publishing/studio-publish-runs", () => ({
  startPublishRun: mocks.startPublishRun,
  updatePublishRun: mocks.updatePublishRun,
}));

const issue = parseIssue(currentIssue);
const checksum = contentChecksum(issue);

describe("automation shadow publish bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.publishSupabaseShadow.mockResolvedValue({
      status: "succeeded",
      changed: true,
      contentVersion: 1,
      compareStatus: "matched",
      differenceCount: 0,
      differencePaths: [],
    });
    mocks.startPublishRun.mockResolvedValue(null);
    mocks.updatePublishRun.mockResolvedValue(null);
  });

  it("records automation trigger with the real primary commit and shared shadow writer", async () => {
    const commitSha = "1234567890abcdef1234567890abcdef12345678";

    const result = await completeShadowPublishAfterPrimary({
      issue,
      triggerType: "automation",
      primaryCommitSha: commitSha,
      throwOnShadowFailure: true,
    });

    expect(result.publishRequestId).toBe(`automation:${commitSha}:${issue.issueDate}:${checksum}`);
    expect(mocks.startPublishRun).toHaveBeenCalledWith(mocks.serviceClient, expect.objectContaining({
      publishRequestId: result.publishRequestId,
      triggerType: "automation",
      primaryStatus: "succeeded",
      primaryCommitSha: commitSha,
    }));
    expect(mocks.publishSupabaseShadow).toHaveBeenCalledWith(
      expect.objectContaining({ issueDate: issue.issueDate }),
      checksum,
      result.publishRequestId,
      mocks.serviceClient,
      "automation",
    );
    expect(mocks.updatePublishRun).toHaveBeenCalledWith(mocks.serviceClient, result.publishRequestId, expect.objectContaining({
      shadowStatus: "succeeded",
      compareStatus: "matched",
      differenceCount: 0,
      finished: true,
    }));
  });

  it("keeps reruns idempotent for the same commit, issue, and checksum", async () => {
    const commitSha = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";

    const first = await completeShadowPublishAfterPrimary({ issue, triggerType: "automation", primaryCommitSha: commitSha });
    const second = await completeShadowPublishAfterPrimary({ issue: structuredClone(issue), triggerType: "automation", primaryCommitSha: commitSha });

    expect(first.publishRequestId).toBe(second.publishRequestId);
    expect(mocks.publishSupabaseShadow).toHaveBeenCalledTimes(2);
  });
});
