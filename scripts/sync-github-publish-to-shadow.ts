import { readFile } from "node:fs/promises";

import { canonicalIssueBundle } from "../apps/web/src/server/publishing/canonical-issue";
import { completeShadowPublishAfterPrimary } from "../apps/web/src/server/publishing/complete-shadow-publish-after-primary";
import { PublishError } from "../apps/web/src/server/publishing/publish-errors";

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

async function readJson(pathname: string) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch (error) {
    throw new PublishError(
      `Unable to read ${pathname}`,
      "GITHUB_ISSUE_READ_FAILED",
      error instanceof SyntaxError ? "json-parse" : "github-read",
    );
  }
}

function shortSha(sha: string) {
  return sha.slice(0, 12);
}

async function main() {
  const commitSha = argValue("--commit-sha")
    || process.env.PRIMARY_COMMIT_SHA
    || process.env.GITHUB_SHA;
  if (!commitSha) {
    throw new PublishError("Missing primary commit SHA", "GITHUB_ISSUE_READ_FAILED", "github-read");
  }

  const currentIssue = await readJson("data/current-issue.json");
  const currentBundle = canonicalIssueBundle(currentIssue);
  const archivePath = `data/archive/${currentBundle.issue.issueDate}.json`;
  const archiveIssue = await readJson(archivePath);
  const archiveBundle = canonicalIssueBundle(archiveIssue);
  if (archiveBundle.issue.issueDate !== currentBundle.issue.issueDate || archiveBundle.checksum !== currentBundle.checksum) {
    throw new PublishError(
      "Current issue and archive issue do not match",
      "ARCHIVE_MISMATCH",
      "github-read",
    );
  }

  const result = await completeShadowPublishAfterPrimary({
    issue: currentBundle.issue,
    triggerType: "automation",
    primaryCommitSha: commitSha,
    shadowTimeoutMs: 12000,
    throwOnShadowFailure: true,
  });

  const output = {
    ok: result.compareStatus === "matched" && result.differenceCount === 0 && !result.errorCode,
    issueDate: result.issueDate,
    publishRequestId: result.publishRequestId,
    primaryCommitSha: shortSha(commitSha),
    shadowStatus: result.shadowStatus,
    shadowChanged: result.shadow?.changed ?? false,
    compareStatus: result.compareStatus,
    differenceCount: result.differenceCount,
    errorCode: result.errorCode || null,
  };
  console.log(JSON.stringify(output));
  if (!output.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const code = error instanceof PublishError ? error.code : "SUPABASE_SHADOW_FAILED";
  const stage = error instanceof PublishError ? error.stage : "unknown";
  console.error(JSON.stringify({
    ok: false,
    errorCode: code,
    errorStage: stage,
    message: error instanceof Error ? error.message : "Automation shadow sync failed",
  }));
  process.exitCode = 1;
});
