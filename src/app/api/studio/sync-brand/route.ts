import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { uploadToCos } from "@/lib/cos/storage";
import { studioCookieName, validStudioOrigin, validStudioSession } from "@/lib/studio/auth";

const brandAssets = [
  "brand/logo/xiazi-global-hot-topics.webp",
  "brand/characters/xiazi/xiazi-master-front.webp",
  "brand/characters/doudou/doudou-master-front.webp",
];

export async function POST(request: Request) {
  if (!validStudioOrigin(request)) {
    return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  }
  const cookieStore = await cookies();
  if (!validStudioSession(cookieStore.get(studioCookieName)?.value)) {
    return NextResponse.json({ message: "登录已过期，请重新进入后台" }, { status: 401 });
  }

  try {
    const siteOrigin = new URL(request.url).origin;
    await Promise.all(brandAssets.map(async (path) => {
      const response = await fetch(`${siteOrigin}/${path}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`无法读取 ${path}`);
      await uploadToCos(path, Buffer.from(await response.arrayBuffer()), "image/webp");
    }));
    return NextResponse.json({ uploaded: brandAssets });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "品牌资源同步失败" },
      { status: 500 },
    );
  }
}
