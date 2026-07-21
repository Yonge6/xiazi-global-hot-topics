import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { studioCookieName, validStudioSession } from "@/lib/studio/auth";
import { listPendingPublications } from "@/server/releases/release-service";

export async function GET() {
  const cookieStore = await cookies();
  if (!validStudioSession(cookieStore.get(studioCookieName)?.value)) {
    return NextResponse.json({ message: "登录已过期，请重新进入后台" }, { status: 401 });
  }
  try {
    return NextResponse.json({ releases: await listPendingPublications() });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "读取待确认 Release 失败" },
      { status: 500 },
    );
  }
}
