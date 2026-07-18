import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { studioCookieName, validStudioOrigin, validStudioSession } from "@/lib/studio/auth";
import { releaseApproverId } from "@/server/releases/release-runtime";
import { approveFuturePublication } from "@/server/releases/release-service";

export async function POST(request: Request, context: { params: Promise<{ releaseId: string }> }) {
  if (!validStudioOrigin(request)) {
    return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  }
  const cookieStore = await cookies();
  if (!validStudioSession(cookieStore.get(studioCookieName)?.value)) {
    return NextResponse.json({ message: "登录已过期，请重新进入后台" }, { status: 401 });
  }
  try {
    const { releaseId } = await context.params;
    const result = await approveFuturePublication(releaseId, await request.json(), releaseApproverId());
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Release 激活失败" },
      { status: 409 },
    );
  }
}
