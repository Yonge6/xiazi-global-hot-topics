import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import sharp from "sharp";

import { copyCosObject, uploadToCos } from "@/lib/cos/storage";
import { studioCookieName, validStudioSession } from "@/lib/studio/auth";

const posterNames: Record<string, string> = {
  "world-cup-global-stage": "world-cup",
  "trade-routes-rewired": "supply-chain",
  "ai-governance-crossroads": "ai-governance",
  "global-health-readiness": "public-health",
  "culture-restoration-digital": "cultural-heritage",
  "energy-transition-grid": "clean-energy",
  "ocean-treaty-action": "high-seas",
  "space-economy-orbit": "space-orbit",
  "climate-adaptation-city": "climate-adaptation",
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!validStudioSession(cookieStore.get(studioCookieName)?.value)) {
    return NextResponse.json({ message: "登录已过期，请重新进入后台" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const locale = form.get("locale");
    const slug = String(form.get("slug") || "");
    const issueDate = String(form.get("issueDate") || "");
    const isCurrent = form.get("isCurrent") === "true";
    if (!(file instanceof File) || (locale !== "zh" && locale !== "en")) {
      return NextResponse.json({ message: "海报文件无效" }, { status: 400 });
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ message: "海报需小于 4MB" }, { status: 413 });
    }

    const name = posterNames[slug] || "ai-governance";
    const original = Buffer.from(await file.arrayBuffer());
    const thumbnail = await sharp(original)
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 72, effort: 5 })
      .toBuffer();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
      return NextResponse.json({ message: "刊期日期无效" }, { status: 400 });
    }
    const archiveOriginal = `archive/${issueDate}/posters/${locale}/${name}.png`;
    const archiveThumbnail = `archive/${issueDate}/posters/thumb/${locale}/${name}.webp`;
    // Posters are served from COS. Keeping binary media out of the GitHub
    // contents API avoids slow, conflicting commits during mobile publishing.
    if (isCurrent) {
      await Promise.all([
        uploadToCos(`posters/${locale}/${name}.png`, original, "image/png"),
        uploadToCos(`posters/thumb/${locale}/${name}.webp`, thumbnail, "image/webp"),
      ]);
      await Promise.all([
        copyCosObject(`posters/${locale}/${name}.png`, archiveOriginal),
        copyCosObject(`posters/thumb/${locale}/${name}.webp`, archiveThumbnail),
      ]);
    } else {
      await Promise.all([
        uploadToCos(archiveOriginal, original, "image/png"),
        uploadToCos(archiveThumbnail, thumbnail, "image/webp"),
      ]);
    }
    return NextResponse.json({ ok: true, version: Date.now() });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "海报上传失败" },
      { status: 500 },
    );
  }
}
