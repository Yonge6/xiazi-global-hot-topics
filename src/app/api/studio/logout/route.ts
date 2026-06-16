import { NextResponse } from "next/server";

import { studioCookieName } from "@/lib/studio/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(studioCookieName, "", { path: "/", maxAge: 0 });
  return response;
}
