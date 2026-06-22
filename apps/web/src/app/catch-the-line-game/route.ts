import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const SOURCE_URL = "https://raw.githubusercontent.com/Yonge6/Design/main/catch-the-line-game/index.html";
const RAW_ASSET_BASE = "https://raw.githubusercontent.com/Yonge6/Design/main/catch-the-line-game/assets/";
const PLUTO_PAGE_URL = "https://pluto.hk/catch-the-line-game/";

async function loadFallbackHtml() {
  const htmlPath = path.join(process.cwd(), "public", "catch-the-line-game", "index.html");
  return readFile(htmlPath, "utf8");
}

function rewriteForPluto(html: string) {
  return html
    .replace(/<base[^>]*>/gi, "")
    .replaceAll('src="assets/', `src="${RAW_ASSET_BASE}`)
    .replaceAll("src='assets/", `src='${RAW_ASSET_BASE}`)
    .replaceAll('href="assets/', `href="${RAW_ASSET_BASE}`)
    .replaceAll("href='assets/", `href='${RAW_ASSET_BASE}`)
    .replace(
      /<head>/i,
      `<head>
  <link rel="canonical" href="${PLUTO_PAGE_URL}" />`,
    );
}

export async function GET() {
  let html: string;

  try {
    const response = await fetch(SOURCE_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Game source returned ${response.status}`);
    html = await response.text();
  } catch {
    html = await loadFallbackHtml();
  }

  return new Response(rewriteForPluto(html), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
