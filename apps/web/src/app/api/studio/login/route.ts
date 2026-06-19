import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { studioCookieName, studioPassword, studioSessionValue, validStudioOrigin } from "@/lib/studio/auth";

const attempts = new Map<string, { count: number; resetAt: number }>();
const windowMs = 60_000;
const maxAttempts = 5;

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
}

export async function POST(request: Request) {
  if (!validStudioOrigin(request)) {
    return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  }

  const key = clientKey(request);
  const now = Date.now();
  const current = attempts.get(key);
  if (current && current.resetAt > now && current.count >= maxAttempts) {
    return NextResponse.json({ message: "尝试次数过多，请稍后再试" }, { status: 429 });
  }

  const { password = "" } = await request.json().catch(() => ({}));
  const expected = studioPassword();
  const supplied = String(password);
  const valid = supplied.length === expected.length
    && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));

  if (!valid) {
    attempts.set(key, {
      count: current && current.resetAt > now ? current.count + 1 : 1,
      resetAt: current && current.resetAt > now ? current.resetAt : now + windowMs,
    });
    return NextResponse.json({ message: "密码不正确" }, { status: 401 });
  }
  attempts.delete(key);

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
