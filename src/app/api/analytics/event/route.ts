import { NextResponse } from "next/server";
import { z } from "zod";

import { analyticsEvents } from "@/lib/analytics/types";
import { recordAnalyticsEvent } from "@/lib/analytics/storage";

const eventSchema = z.object({
  event: z.enum(analyticsEvents),
  locale: z.enum(["zh", "en"]),
  slug: z.string().max(100).optional(),
  visitorId: z.string().uuid().optional(),
  durationSeconds: z.number().int().min(1).max(1800).optional(),
});

export async function POST(request: Request) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "无效统计事件" }, { status: 400 });
  }

  try {
    await recordAnalyticsEvent(parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "统计暂时不可用" }, { status: 503 });
  }
}
