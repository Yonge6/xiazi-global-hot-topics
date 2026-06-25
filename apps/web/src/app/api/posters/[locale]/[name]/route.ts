import { NextResponse } from "next/server";

import { cachedFetchInit, POSTER_CACHE_CONTROL, POSTER_CDN_CACHE_CONTROL, POSTER_REVALIDATE_SECONDS } from "@/lib/cache/public-cache";
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

  const searchParams = new URL(request.url).searchParams;
  const thumbnail = searchParams.get("variant") === "thumbnail";
  const issueDate = searchParams.get("issueDate");
  const cacheKey = searchParams.get("v") || "current";
  if (issueDate && !safeIssueDate.test(issueDate)) {
    return NextResponse.json({ message: "Poster not found" }, { status: 404 });
  }
  const extension = thumbnail ? "webp" : "png";
  const folder = thumbnail ? "thumb/" : "";
  const path = issueDate
    ? `public/archive/${issueDate}/posters/${folder}${locale}/${name}.${extension}`
    : `public/posters/${folder}${locale}/${name}.${extension}`;
  const fallbackPath = `/${path.replace(/^public\//, "")}`;
  const [owner, repository] = repo.split("/");
  const rawUrl = new URL(`https://raw.githubusercontent.com/${owner}/${repository}/main/${path}`);
  rawUrl.searchParams.set("v", cacheKey);

  try {
    const response = await fetch(rawUrl, cachedFetchInit(POSTER_REVALIDATE_SECONDS));
    if (!response.ok) throw new Error("Poster source unavailable");

    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        "Content-Type": thumbnail ? "image/webp" : "image/png",
        "Cache-Control": POSTER_CACHE_CONTROL,
        "CDN-Cache-Control": POSTER_CDN_CACHE_CONTROL,
      },
    });
  } catch {
    return NextResponse.redirect(new URL(fallbackPath, request.url), 307);
  }
}
