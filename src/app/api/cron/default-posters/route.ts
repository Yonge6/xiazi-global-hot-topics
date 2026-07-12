import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import sharp from "sharp";

import { uploadToCos } from "@/lib/cos/storage";
import { POSTER_ASSET_NAMES } from "@/lib/posters/assets";

export const maxDuration = 300;

function beijingIssueDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ message: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const issueDate = beijingIssueDate();
    const source = await readFile(path.join(process.cwd(), "public/posters/default-poster.jpg"));
    const original = await sharp(source).png({ compressionLevel: 9 }).toBuffer();
    const assets = ["zh", "en"].flatMap((locale) =>
      POSTER_ASSET_NAMES.flatMap((name) => [
        { key: `posters/${locale}/${name}.png`, content: original, type: "image/png" },
        { key: `archive/${issueDate}/posters/${locale}/${name}.png`, content: original, type: "image/png" },
      ]),
    );

    for (let index = 0; index < assets.length; index += 8) {
      await Promise.all(
        assets.slice(index, index + 8).map((asset) =>
          uploadToCos(
            asset.key,
            asset.content,
            asset.type,
            "public, max-age=300, stale-while-revalidate=86400",
          ),
        ),
      );
    }

    return NextResponse.json({ ok: true, issueDate, uploaded: assets.length });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Default poster sync failed" },
      { status: 500 },
    );
  }
}
