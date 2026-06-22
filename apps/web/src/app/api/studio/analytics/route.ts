import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { readAnalyticsDashboard } from "@/lib/analytics/storage";
import { studioCookieName, validStudioSession } from "@/lib/studio/auth";

export async function GET() {
  const cookieStore = await cookies();
  if (!validStudioSession(cookieStore.get(studioCookieName)?.value)) {
    return NextResponse.json({ message: "登录已过期，请重新进入后台" }, { status: 401 });
  }
  return NextResponse.json(await readAnalyticsDashboard(), {
    headers: { "Cache-Control": "no-store" },
  });
}
