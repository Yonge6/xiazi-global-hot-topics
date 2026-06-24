import type { Issue } from "@xiazi/contracts";

import {
  listProductionArchiveIssues,
  loadLatestProductionIssue,
  loadProductionIssueByDate,
} from "../json/production-json-source";
import type { ContentRepository, IssueSummary } from "./content-repository";

export class JsonContentRepository implements ContentRepository {
  constructor() {}

  async getLatestPublishedIssue(): Promise<Issue> {
    return (await loadLatestProductionIssue()).issue;
  }

  async getIssueByDate(date: string): Promise<Issue | null> {
    return (await loadProductionIssueByDate(date))?.issue ?? null;
  }

  async listPublishedIssues(): Promise<IssueSummary[]> {
    return listProductionArchiveIssues();
  }
}
