import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { studioCookieName, validStudioOrigin, validStudioSession } from "@/lib/studio/auth";
import { publishIssueFromStudio } from "@/server/publishing/publish-issue";
import type { PublishTarget } from "@/server/publishing/publish-github-primary";

export async function POST(request: Request) {
  if (!validStudioOrigin(request)) {
    return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  }
  const cookieStore = await cookies();
  if (!validStudioSession(cookieStore.get(studioCookieName)?.value)) {
    return NextResponse.json({ message: "登录已过期，请重新进入后台" }, { status: 401 });
  }

  try {
    const payload = await request.json() as {
      issue: unknown;
      target?: PublishTarget;
    };
    const result = await publishIssueFromStudio({
      issue: payload.issue,
      target: payload.target,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "发布失败" },
      { status: 500 },
    );
  }
}
