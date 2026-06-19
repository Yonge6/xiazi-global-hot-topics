import { NextResponse } from "next/server";

import { studioCookieName, validStudioOrigin } from "@/lib/studio/auth";

export async function POST(request: Request) {
  if (!validStudioOrigin(request)) {
    return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(studioCookieName, "", { path: "/", maxAge: 0 });
  return response;
}
