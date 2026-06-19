import { NextResponse } from "next/server";

import { githubRepo } from "@/lib/github/repo";
import { POSTER_ASSET_NAMES } from "@/lib/posters/assets";

const repo = githubRepo;
const locales = new Set(["zh", "en"]);
const posterNames = new Set<string>(POSTER_ASSET_NAMES);

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ locale: string; name: string }> },
) {
  const { locale, name } = await context.params;
  if (!locales.has(locale) || !posterNames.has(name)) {
    return NextResponse.json({ message: "Poster not found" }, { status: 404 });
  }

  const searchParams = new URL(request.url).searchParams;
  const thumbnail = searchParams.get("variant") === "thumbnail";
  const issueDate = searchParams.get("issueDate");
  if (issueDate && !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
    return NextResponse.json({ message: "Poster not found" }, { status: 404 });
  }
  const extension = thumbnail ? "webp" : "png";
  const folder = thumbnail ? "thumb/" : "";
  const path = issueDate
    ? `public/archive/${issueDate}/posters/${folder}${locale}/${name}.${extension}`
    : `public/posters/${folder}${locale}/${name}.${extension}`;
  const fallbackPath = `/${path.replace(/^public\//, "")}`;
  const token = process.env.GITHUB_STUDIO_TOKEN;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}?ref=main`,
      {
        cache: "no-store",
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
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
        "CDN-Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.redirect(new URL(fallbackPath, request.url), 307);
  }
}
