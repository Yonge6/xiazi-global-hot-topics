import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { studioCookieName, validStudioOrigin, validStudioSession } from "@/lib/studio/auth";
import { retryStudioShadowPublish } from "@/server/publishing/retry-shadow-publish";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publishRequestId: string }> },
) {
  if (!validStudioOrigin(request)) {
    return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  }
  const cookieStore = await cookies();
  if (!validStudioSession(cookieStore.get(studioCookieName)?.value)) {
    return NextResponse.json({ message: "登录已过期，请重新进入后台" }, { status: 401 });
  }

  try {
    const { publishRequestId } = await params;
    if (!publishRequestId.startsWith("studio-publish:")) {
      return NextResponse.json({ message: "发布请求编号无效" }, { status: 400 });
    }
    return NextResponse.json(await retryStudioShadowPublish(publishRequestId));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "影子同步重试失败" },
      { status: 500 },
    );
  }
}
