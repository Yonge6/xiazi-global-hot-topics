import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { copyCosObject } from "@/lib/cos/storage";
import { studioCookieName, validStudioSession } from "@/lib/studio/auth";

const posterNames = [
  "world-cup",
  "supply-chain",
  "ai-governance",
  "public-health",
  "cultural-heritage",
  "clean-energy",
  "high-seas",
  "space-orbit",
  "climate-adaptation",
];

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!validStudioSession(cookieStore.get(studioCookieName)?.value)) {
    return NextResponse.json({ message: "登录已过期，请重新进入后台" }, { status: 401 });
  }

  const { issueDate = "" } = await request.json().catch(() => ({}));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
    return NextResponse.json({ message: "刊期日期无效" }, { status: 400 });
  }

  try {
    const assets = posterNames.flatMap((name) => [
      { source: `posters/zh/${name}.png`, target: `archive/${issueDate}/posters/zh/${name}.png` },
      { source: `posters/en/${name}.png`, target: `archive/${issueDate}/posters/en/${name}.png` },
      { source: `posters/thumb/zh/${name}.webp`, target: `archive/${issueDate}/posters/thumb/zh/${name}.webp` },
      { source: `posters/thumb/en/${name}.webp`, target: `archive/${issueDate}/posters/thumb/en/${name}.webp` },
    ]);

    for (let index = 0; index < assets.length; index += 8) {
      await Promise.all(assets.slice(index, index + 8).map((asset) =>
        copyCosObject(asset.source, asset.target),
      ));
    }
    return NextResponse.json({ issueDate, uploaded: assets.length });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "往期海报归档失败" },
      { status: 500 },
    );
  }
}
