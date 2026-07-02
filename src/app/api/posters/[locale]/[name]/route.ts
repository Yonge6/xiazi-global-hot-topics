import { NextResponse } from "next/server";

import { githubRepo } from "@/lib/github/repo";

const repo = githubRepo;
const locales = new Set(["zh", "en"]);
const safeName = /^[a-z0-9-]+$/;
const safeIssueDate = /^\d{4}-\d{2}-\d{2}$/;

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ locale: string; name: string }> },
) {
  const { locale, name } = await context.params;
  if (!locales.has(locale) || !safeName.test(name)) {
    return NextResponse.json({ message: "Poster not found" }, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const thumbnail = params.get("variant") === "thumbnail";
  const issueDate = params.get("issueDate");
  const cacheKey = params.get("v");
  const extension = thumbnail ? "webp" : "png";
  const pathPrefix = issueDate && safeIssueDate.test(issueDate)
    ? `archive/${issueDate}/posters${thumbnail ? "/thumb" : ""}`
    : `posters${thumbnail ? "/thumb" : ""}`;
  const path = `${pathPrefix}/${locale}/${name}.${extension}`;
  const fallbackPath = `/${path}`;
  const token = process.env.GITHUB_STUDIO_TOKEN;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/public/${path}?ref=main${cacheKey ? `&v=${encodeURIComponent(cacheKey)}` : ""}`,
      {
        cache: "no-store",
        next: { revalidate: 0 },
        headers: {
          Accept: "application/vnd.github.raw+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (!response.ok) throw new Error("Poster source unavailable");

    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        "Content-Type": thumbnail ? "image/webp" : "image/png",
        "Cache-Control": "no-store, max-age=0",
        "CDN-Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.redirect(new URL(fallbackPath, request.url), 307);
  }
}
