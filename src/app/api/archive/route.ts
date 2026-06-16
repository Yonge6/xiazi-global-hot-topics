import { NextResponse } from "next/server";

import type { Issue } from "@/types/content";

const repo = "Yonge6/vilesaint";

async function github(path: string, accept = "application/vnd.github+json") {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    cache: "no-store",
    headers: {
      Accept: accept,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error("Archive unavailable");
  }
  return response.json();
}

export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date");
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ message: "Invalid archive date" }, { status: 400 });
      }
      const issue = await github(
        `contents/data/archive/${date}.json`,
        "application/vnd.github.raw+json",
      ) as Issue | null;
      if (!issue) return NextResponse.json({ message: "Archive not found" }, { status: 404 });
      return NextResponse.json({ issue, assetVersion: issue.assetVersion || issue.beijingTimestamp || date });
    }

    const files = await github("contents/data/archive");
    const issues = Array.isArray(files)
      ? files
          .filter((file) => file.type === "file" && /^\d{4}-\d{2}-\d{2}\.json$/.test(file.name))
          .map((file) => file.name.replace(".json", ""))
          .sort((a, b) => b.localeCompare(a))
      : [];
    return NextResponse.json({ issues });
  } catch {
    return NextResponse.json({ message: "Archive unavailable" }, { status: 500 });
  }
}
