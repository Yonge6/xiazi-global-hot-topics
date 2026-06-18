import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

export async function GET() {
  const htmlPath = path.join(process.cwd(), "public", "english-quote-log", "index.html");
  const html = await readFile(htmlPath, "utf8");

  return new Response(html, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
