import type { Issue } from "@xiazi/contracts";

import type { ContentRepository, IssueSummary } from "./content-repository";
import { JsonContentRepository } from "./json-content-repository";
import {
  fallbackReasonFor,
  nowMs,
  recordContentReadRun,
  withReadTimeout,
  type ReadFallbackReason,
  type ReadPathType,
} from "./read-health";
import { SupabaseContentRepository } from "./supabase-content-repository";

export class SupabasePrimaryWithJsonFallbackRepository implements ContentRepository {
  constructor(
    private readonly supabase: ContentRepository = new SupabaseContentRepository(),
    private readonly json: ContentRepository = new JsonContentRepository(),
  ) {}

  private async fallback<T>(
    pathType: ReadPathType,
    issueDate: string | null,
    reason: ReadFallbackReason,
    supabaseDurationMs: number,
    readJson: () => Promise<T>,
  ): Promise<T> {
    const jsonStart = nowMs();
    const value = await readJson();
    const jsonDurationMs = nowMs() - jsonStart;
    await recordContentReadRun({
      pathType,
      issueDate,
      primarySource: "supabase",
      fallbackUsed: true,
      fallbackReason: reason,
      supabaseDurationMs,
      jsonDurationMs,
    });
    return value;
  }

  async getLatestPublishedIssue(): Promise<Issue> {
    const supabaseStart = nowMs();
    try {
      const issue = await withReadTimeout(this.supabase.getLatestPublishedIssue());
      const supabaseDurationMs = nowMs() - supabaseStart;
      const jsonStart = nowMs();
      const jsonIssue = await this.json.getLatestPublishedIssue();
      const jsonDurationMs = nowMs() - jsonStart;
      if (jsonIssue.issueDate > issue.issueDate) {
        await recordContentReadRun({
          pathType: "latest",
          issueDate: jsonIssue.issueDate,
          primarySource: "supabase",
          fallbackUsed: true,
          fallbackReason: "SUPABASE_ISSUE_MISSING",
          supabaseDurationMs,
          jsonDurationMs,
        });
        return jsonIssue;
      }
      await recordContentReadRun({
        pathType: "latest",
        issueDate: issue.issueDate,
        primarySource: "supabase",
        fallbackUsed: false,
        supabaseDurationMs,
        jsonDurationMs,
      });
      return issue;
    } catch (error) {
      return this.fallback(
        "latest",
        null,
        fallbackReasonFor(error, "SUPABASE_READ_FAILED"),
        nowMs() - supabaseStart,
        () => this.json.getLatestPublishedIssue(),
      );
    }
  }

  async getIssueByDate(date: string): Promise<Issue | null> {
    const supabaseStart = nowMs();
    try {
      const issue = await withReadTimeout(this.supabase.getIssueByDate(date));
      const duration = nowMs() - supabaseStart;
      if (!issue) {
        return this.fallback("issue", date, "SUPABASE_ISSUE_MISSING", duration, () => this.json.getIssueByDate(date));
      }
      await recordContentReadRun({
        pathType: "issue",
        issueDate: date,
        primarySource: "supabase",
        fallbackUsed: false,
        supabaseDurationMs: duration,
      });
      return issue;
    } catch (error) {
      return this.fallback(
        "issue",
        date,
        fallbackReasonFor(error, "SUPABASE_READ_FAILED"),
        nowMs() - supabaseStart,
        () => this.json.getIssueByDate(date),
      );
    }
  }

  async listPublishedIssues(): Promise<IssueSummary[]> {
    const supabaseStart = nowMs();
    try {
      const issues = await withReadTimeout(this.supabase.listPublishedIssues());
      await recordContentReadRun({
        pathType: "archive",
        primarySource: "supabase",
        fallbackUsed: false,
        supabaseDurationMs: nowMs() - supabaseStart,
      });
      return issues;
    } catch (error) {
      return this.fallback(
        "archive",
        null,
        fallbackReasonFor(error, "SUPABASE_ARCHIVE_FAILED"),
        nowMs() - supabaseStart,
        () => this.json.listPublishedIssues(),
      );
    }
  }
}
