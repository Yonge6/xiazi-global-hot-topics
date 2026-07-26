import { NextResponse } from "next/server";

import { cachedFetchInit, POSTER_CACHE_CONTROL, POSTER_CDN_CACHE_CONTROL, POSTER_REVALIDATE_SECONDS } from "@/lib/cache/public-cache";
import { githubRepo } from "@/lib/github/repo";
import { resolvePosterName } from "@/lib/posters/assets";
import { isHistoricalReleaseDate } from "@xiazi/domain";
import {
  loadPublicationByReleaseId,
  loadVerifiedPoster,
} from "@/server/releases/release-service";
import { releaseV2Enabled } from "@/server/releases/release-runtime";

const repo = githubRepo;
const locales = new Set(["zh", "en"]);
const safeName = /^[a-z0-9-]+$/;
const safeIssueDate = /^\d{4}-\d{2}-\d{2}$/;
const safeReleaseId = /^rel_\d{8}_[0-9a-f]{24}$/;

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

  const isLegacyGithubArchive = Boolean(issueDate && isHistoricalReleaseDate(issueDate));
  if (releaseV2Enabled() && !isLegacyGithubArchive) {
    if (!safeReleaseId.test(cacheKey)) {
      return NextResponse.json(
        { message: "A releaseId is required for immutable poster delivery" },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    try {
      const publication = await loadPublicationByReleaseId(cacheKey);
      const topic = publication?.issue.topics.find((item) => resolvePosterName(item.slug) === name);
      if (!publication || !topic || (issueDate && publication.issue.issueDate !== issueDate)) {
        return NextResponse.json({ message: "Poster not found" }, { status: 404 });
      }
      const poster = await loadVerifiedPoster(cacheKey, topic.id, locale as "zh" | "en");
      if (!poster) return NextResponse.json({ message: "Poster not found" }, { status: 404 });
      const destination = new URL(poster.url);
      destination.searchParams.set("contentHash", poster.contentHash);
      return NextResponse.redirect(destination, {
        status: 307,
        headers: {
          "Cache-Control": POSTER_CACHE_CONTROL,
          "CDN-Cache-Control": POSTER_CDN_CACHE_CONTROL,
          "X-Xiazi-Release-Id": cacheKey,
          "X-Xiazi-Content-Hash": poster.contentHash,
        },
      });
    } catch {
      return NextResponse.json(
        { message: "Verified release poster unavailable", publicationHealth: "degraded", stale: true },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  const extension = thumbnail ? "webp" : "png";
  const folder = thumbnail ? "thumb/" : "";
  const path = issueDate
    ? `public/archive/${issueDate}/posters/${folder}${locale}/${name}.${extension}`
    : `public/posters/${folder}${locale}/${name}.${extension}`;
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
    return NextResponse.json(
      { message: "Remote poster archive unavailable", publicationHealth: "degraded", stale: true },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
