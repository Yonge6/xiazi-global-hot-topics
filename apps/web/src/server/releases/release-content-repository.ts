import type { Issue } from "@xiazi/contracts";
import { HISTORICAL_RELEASE_CUTOFF } from "@xiazi/domain";

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
    const active = await loadActivePublication();
    if (!active) throw new Error("ACTIVE_RELEASE_NOT_CONFIGURED");
    return active.issue;
  }

  async getIssueByDate(date: string): Promise<Issue | null> {
    if (date <= HISTORICAL_RELEASE_CUTOFF) return this.historical.getIssueByDate(date);
    const publication = await loadPublicationByDate(date);
    return publication?.issue || null;
  }

  async listPublishedIssues(): Promise<IssueSummary[]> {
    const [publications, historical] = await Promise.all([
      listPublishedPublications(),
      this.historical.listPublishedIssues(),
    ]);
    const future = publications.map(({ issue }) => ({
      issueDate: issue.issueDate,
      slug: issue.slug,
      status: issue.status,
      source: "supabase-release" as const,
    }));
    return [...future, ...historical.filter((issue) => issue.issueDate <= HISTORICAL_RELEASE_CUTOFF)]
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }
}
