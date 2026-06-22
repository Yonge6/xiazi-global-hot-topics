import type { Issue } from "@xiazi/contracts";

export type IssueSummary = {
  issueDate: string;
  slug: string;
  status: Issue["status"];
  source: "github" | "local" | "public-fallback" | "supabase";
};

export interface ContentRepository {
  getLatestPublishedIssue(): Promise<Issue>;
  getIssueByDate(date: string): Promise<Issue | null>;
  listPublishedIssues(): Promise<IssueSummary[]>;
}
