import type { Issue } from "@xiazi/contracts";
import { isHistoricalReleaseDate } from "@xiazi/domain";

import type { ContentRepository, IssueSummary } from "../repositories/content-repository";
import { JsonContentRepository } from "../repositories/json-content-repository";
import {
  listPublishedPublications,
  loadActivePublication,
  loadPublicationByDate,
} from "./release-service";

export class ReleaseContentRepository implements ContentRepository {
  private readonly historical = new JsonContentRepository();

  async getLatestPublishedIssue(): Promise<Issue> {
    const active = await loadActivePublication().catch(() => null);
    if (active) return active.issue;
    return this.historical.getLatestPublishedIssue();
  }

  async getIssueByDate(date: string): Promise<Issue | null> {
    if (isHistoricalReleaseDate(date)) return this.historical.getIssueByDate(date);
    const publication = await loadPublicationByDate(date).catch(() => null);
    if (publication) return publication.issue;
    return this.historical.getIssueByDate(date);
  }

  async listPublishedIssues(): Promise<IssueSummary[]> {
    const [publications, historical] = await Promise.all([
      listPublishedPublications().catch(() => []),
      this.historical.listPublishedIssues().catch(() => []),
    ]);
    const future = publications.map(({ issue }) => ({
      issueDate: issue.issueDate,
      slug: issue.slug,
      status: issue.status,
      source: "supabase-release" as const,
    }));
    const merged = new Map(historical.map((issue) => [issue.issueDate, issue]));
    for (const issue of future) merged.set(issue.issueDate, issue);
    return Array.from(merged.values()).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }
}
