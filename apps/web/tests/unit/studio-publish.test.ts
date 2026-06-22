import { beforeEach, describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { contentChecksum } from "@/server/content-sync/issue-bundle";
import { PublishError } from "@/server/publishing/publish-errors";
import { publishIssueFromStudio } from "@/server/publishing/publish-issue";
import { parseIssue } from "@xiazi/contracts";

const mocks = vi.hoisted(() => ({
  serviceClient: {},
  publishGitHubPrimary: vi.fn(),
  publishSupabaseShadow: vi.fn(),
  startStudioPublishRun: vi.fn(),
  updateStudioPublishRun: vi.fn(),
}));

vi.mock("@/server/content-sync/supabase-service-client", () => ({
  createSupabaseServiceClientFromEnv: () => mocks.serviceClient,
}));

vi.mock("@/server/publishing/publish-github-primary", () => ({
  publishGitHubPrimary: mocks.publishGitHubPrimary,
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
  startStudioPublishRun: mocks.startStudioPublishRun,
  updateStudioPublishRun: mocks.updateStudioPublishRun,
}));

const issue = parseIssue(currentIssue);
const checksum = contentChecksum(issue);

describe("Studio publish shadow write", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STUDIO_SHADOW_WRITE_ENABLED = "true";
    mocks.publishGitHubPrimary.mockResolvedValue({
      target: { source: "current", value: "current" },
      commitSha: "github-commit",
    });
    mocks.publishSupabaseShadow.mockResolvedValue({
      status: "succeeded",
      changed: true,
      contentVersion: 1,
      compareStatus: "matched",
      differenceCount: 0,
      differencePaths: [],
    });
    mocks.startStudioPublishRun.mockResolvedValue(null);
    mocks.updateStudioPublishRun.mockResolvedValue(null);
  });

  it("keeps Studio on GitHub-only publishing when shadow write is disabled by default", async () => {
    delete process.env.STUDIO_SHADOW_WRITE_ENABLED;

    const result = await publishIssueFromStudio({ issue });

    expect(result.published).toBe(true);
    expect(result.primary).toMatchObject({ target: "github", status: "succeeded", commitSha: "github-commit" });
    expect(result.shadow).toMatchObject({ target: "supabase", status: "disabled", changed: false });
    expect(result.compare).toMatchObject({ status: "not_started", differenceCount: 0 });
    expect(mocks.startStudioPublishRun).not.toHaveBeenCalled();
    expect(mocks.updateStudioPublishRun).not.toHaveBeenCalled();
    expect(mocks.publishSupabaseShadow).not.toHaveBeenCalled();
  });

  it("publishes one canonical issue bundle to GitHub and then Supabase", async () => {
    const result = await publishIssueFromStudio({ issue });

    expect(result.published).toBe(true);
    expect(result.issueDate).toBe(issue.issueDate);
    expect(result.publishRequestId).toBe(`studio-publish:${issue.issueDate}:${checksum}`);
    expect(result.primary).toMatchObject({ target: "github", status: "succeeded", commitSha: "github-commit" });
    expect(result.shadow).toMatchObject({ target: "supabase", status: "succeeded", changed: true });
    expect(result.compare).toMatchObject({ status: "matched", differenceCount: 0 });
    expect(mocks.publishGitHubPrimary).toHaveBeenCalledWith(expect.objectContaining({ issueDate: issue.issueDate }), undefined);
    expect(mocks.publishSupabaseShadow).toHaveBeenCalledWith(
      expect.objectContaining({ issueDate: issue.issueDate }),
      checksum,
      result.publishRequestId,
      mocks.serviceClient,
    );
  });

  it("does not call Supabase shadow write when GitHub primary write fails", async () => {
    mocks.publishGitHubPrimary.mockRejectedValue(new PublishError("conflict", "GITHUB_CONFLICT", "github"));

    await expect(publishIssueFromStudio({ issue })).rejects.toThrow("conflict");
    expect(mocks.publishSupabaseShadow).not.toHaveBeenCalled();
    expect(mocks.updateStudioPublishRun).toHaveBeenCalledWith(expect.anything(), expect.any(String), expect.objectContaining({
      primaryStatus: "failed",
      shadowStatus: "not_started",
      errorCode: "GITHUB_CONFLICT",
    }));
  });

  it("returns published=true when Supabase shadow write fails after GitHub succeeds", async () => {
    mocks.publishSupabaseShadow.mockRejectedValue(new PublishError("supabase down", "SUPABASE_SHADOW_FAILED", "supabase"));

    const result = await publishIssueFromStudio({ issue });

    expect(result.published).toBe(true);
    expect(result.primary.status).toBe("succeeded");
    expect(result.shadow.status).toBe("failed");
    expect(result.compare.status).toBe("failed");
    expect(mocks.updateStudioPublishRun).toHaveBeenCalledWith(expect.anything(), result.publishRequestId, expect.objectContaining({
      shadowStatus: "failed",
      errorCode: "SUPABASE_SHADOW_FAILED",
      finished: true,
    }));
  });

  it("marks timeout without exposing secrets or stack traces", async () => {
    mocks.publishSupabaseShadow.mockImplementation(() => new Promise(() => undefined));

    const result = await publishIssueFromStudio({ issue, shadowTimeoutMs: 1 });
    const serialized = JSON.stringify(result);

    expect(result.published).toBe(true);
    expect(result.shadow.status).toBe("timeout");
    expect(serialized).not.toContain("SUPABASE_SECRET");
    expect(serialized).not.toContain("GITHUB_STUDIO_TOKEN");
    expect(serialized).not.toContain("stack");
  });

  it("surfaces compare mismatches as partial success", async () => {
    mocks.publishSupabaseShadow.mockResolvedValue({
      status: "succeeded",
      changed: true,
      contentVersion: 2,
      compareStatus: "mismatched",
      differenceCount: 1,
      differencePaths: ["topics[0].localizations.en-US.headlineFull"],
    });

    const result = await publishIssueFromStudio({ issue });

    expect(result.published).toBe(true);
    expect(result.compare.status).toBe("mismatched");
    expect(result.compare.differenceCount).toBe(1);
  });

  it("uses the same idempotency key for repeated identical payloads", async () => {
    const first = await publishIssueFromStudio({ issue });
    const second = await publishIssueFromStudio({ issue: structuredClone(issue) });

    expect(first.publishRequestId).toBe(second.publishRequestId);
    expect(first.publishRequestId).toBe(`studio-publish:${issue.issueDate}:${checksum}`);
  });
});
