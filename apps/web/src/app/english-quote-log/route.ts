import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const SOURCE_URL = "https://raw.githubusercontent.com/Yonge6/Design/main/english-quote-log/index.html";
const OLD_PAGE_URL = "https://yonge6.github.io/Design/english-quote-log/";
const PLUTO_PAGE_URL = "https://pluto.hk/english-quote-log/";

async function loadFallbackHtml() {
  const htmlPath = path.join(process.cwd(), "public", "english-quote-log", "index.html");
  return readFile(htmlPath, "utf8");
}

export async function GET() {
  let html: string;

  try {
    const response = await fetch(SOURCE_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Quote source returned ${response.status}`);
    html = await response.text();
  } catch {
    html = await loadFallbackHtml();
  }

  html = html.replaceAll(OLD_PAGE_URL, PLUTO_PAGE_URL);

  return new Response(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
