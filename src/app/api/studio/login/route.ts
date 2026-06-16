import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { studioCookieName, studioSessionValue } from "@/lib/studio/auth";

export async function POST(request: Request) {
  const { password = "" } = await request.json().catch(() => ({}));
  const expected = process.env.STUDIO_PASSWORD ?? "000000";
  const supplied = String(password);
  const valid = supplied.length === expected.length
    && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));

  if (!valid) {
    return NextResponse.json({ message: "密码不正确" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(studioCookieName, studioSessionValue(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
