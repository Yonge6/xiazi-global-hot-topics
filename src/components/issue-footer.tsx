"use client";

import { useEffect, useState } from "react";

export function IssueFooter({ issueDate, slogan }: { issueDate: string; slogan: string }) {
  const [currentIssueDate, setCurrentIssueDate] = useState(issueDate);

  useEffect(() => {
    fetch("/api/content/", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((issue) => {
        if (issue && typeof issue.issueDate === "string") setCurrentIssueDate(issue.issueDate);
      })
      .catch(() => undefined);
  }, []);

  return (
    <footer className="catalogue-footer">
      <div className="shell">
        <p>{slogan}</p>
        <div>
          <span>ISSN {currentIssueDate.replaceAll("-", "-")}</span>
          <span>BEIJING · 00:05 DAILY</span>
          <strong>pluto.hk</strong>
        </div>
      </div>
    </footer>
  );
}
