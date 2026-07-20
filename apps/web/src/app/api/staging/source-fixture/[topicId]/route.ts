import { NextResponse } from "next/server";

import { stagingFixtureClaims } from "@/server/releases/staging-rehearsal-fixture";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ topicId: string }> }) {
  if (process.env.RELEASE_ENVIRONMENT !== "staging") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const { topicId } = await context.params;
  const match = topicId.match(/^staging-topic-(\d{2})$/);
  const claim = match ? stagingFixtureClaims[Number(match[1]) - 1] : undefined;
  if (!claim) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const mode = new URL(request.url).searchParams.get("mode") || "supported";
  if (mode === "redirect-localhost") return NextResponse.redirect("https://127.0.0.1/private", 302);
  if (mode === "redirect-private-ipv4") return NextResponse.redirect("https://10.0.0.1/private", 302);
  if (mode === "redirect-private-ipv6") return NextResponse.redirect("https://[fd00::1]/private", 302);
  if (mode === "redirect-loop") return NextResponse.redirect(request.url, 302);
  if (mode === "too-large") {
    return new NextResponse(`<!doctype html><title>Oversized staging fixture</title><p>${"x".repeat(600_000)}</p>`, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const marker = mode === "correction" ? "<p>Correction: this controlled fixture was corrected.</p>"
    : mode === "retraction" ? "<p>Retraction notice: this controlled fixture has been retracted.</p>"
      : "";
  const html = `<!doctype html>
    <html><head><title>Release V2 staging source ${topicId}</title></head>
    <body><main><h1>${claim.enHeadline}</h1><p>${claim.enIntro}</p>
    <h2>${claim.zhHeadline}</h2><p>${claim.zhIntro}</p>${marker}
    <p>This page is a deterministic, public HTTPS source fixture for Release V2 fault injection.</p>
    </main></body></html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
