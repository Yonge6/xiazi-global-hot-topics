import { readFile } from "node:fs/promises";
import path from "node:path";

const issuePath = path.resolve(process.argv[2] || "data/current-issue.json");
const issue = JSON.parse(await readFile(issuePath, "utf8"));
const token = process.env.GITHUB_STUDIO_TOKEN;
const repo = process.env.GITHUB_REPO || "Yonge6/vilesaint";

if (!token) throw new Error("GITHUB_STUDIO_TOKEN is required");
if (!/^\d{4}-\d{2}-\d{2}$/.test(issue.issueDate || "")) {
  throw new Error("Issue date is invalid");
}

async function github(pathname, init = {}) {
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${pathname}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
  const detail = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${pathname}: ${detail?.message || response.status}`);
  return detail;
}

async function writeJson(pathname, value, message) {
  const current = await fetch(`https://api.github.com/repos/${repo}/contents/${pathname}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const existing = current.status === 404 ? null : await current.json();
  if (!current.ok && current.status !== 404) {
    throw new Error(`${pathname}: ${existing?.message || current.status}`);
  }
  return github(pathname, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8").toString("base64"),
      ...(existing?.sha ? { sha: existing.sha } : {}),
    }),
  });
}

const archivePath = `data/archive/${issue.issueDate}.json`;
const archive = await writeJson(archivePath, issue, `Archive issue ${issue.issueDate}`);
const current = await writeJson("data/current-issue.json", issue, `Update issue ${issue.issueDate}`);

console.log(JSON.stringify({
  issueDate: issue.issueDate,
  archiveCommit: archive.commit?.sha,
  currentCommit: current.commit?.sha,
}, null, 2));
