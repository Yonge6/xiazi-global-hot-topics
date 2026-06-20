import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const SOURCE_URL = "https://raw.githubusercontent.com/Yonge6/Design/main/english-quote-log/index.html";
const OLD_PAGE_URL = "https://yonge6.github.io/Design/english-quote-log/";
const PLUTO_PAGE_URL = "https://pluto.hk/english-quote-log/";
const HEADER_MARKER = "pluto-shared-site-header";

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

  html = injectPlutoNavigation(html.replaceAll(OLD_PAGE_URL, PLUTO_PAGE_URL));

  return new Response(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

export function injectPlutoNavigation(html: string) {
  if (html.includes(HEADER_MARKER)) return html;

  const header = `
  <style data-${HEADER_MARKER}>
    .pluto-site-header {
      position: sticky;
      z-index: 50;
      top: 0;
      border-bottom: 1px solid rgba(32, 25, 18, .12);
      background: rgba(249, 244, 235, .94);
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
    }
    .pluto-site-header * { box-sizing: border-box; }
    .pluto-site-header-shell {
      width: min(100% - 48px, 1480px);
      min-height: 76px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }
    .pluto-brand-lockup {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
    }
    .pluto-brand-logo {
      width: 74px;
      height: 60px;
      object-fit: contain;
      object-position: left center;
      display: block;
    }
    .pluto-header-right,
    .pluto-header-nav {
      display: flex;
      align-items: center;
    }
    .pluto-header-right { gap: 46px; }
    .pluto-header-nav { gap: 34px; }
    .pluto-header-nav a,
    .pluto-language-switcher,
    .pluto-mobile-menu summary,
    .pluto-mobile-menu-panel a {
      color: #3a332b;
      font: 600 13px/1.1 ui-serif, Georgia, "Times New Roman", "Noto Serif SC", serif;
      letter-spacing: .08em;
      text-decoration: none;
    }
    .pluto-header-nav a:hover,
    .pluto-language-switcher:hover,
    .pluto-mobile-menu-panel a:hover { color: #b63a2e; }
    .pluto-language-switcher {
      display: inline-flex;
      gap: 8px;
      align-items: center;
    }
    .pluto-language-switcher .active { color: #b63a2e; }
    .pluto-mobile-menu { display: none; position: relative; }
    .pluto-mobile-menu summary {
      list-style: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .pluto-mobile-menu summary::-webkit-details-marker { display: none; }
    .pluto-mobile-menu-panel {
      position: absolute;
      top: calc(100% + 18px);
      right: 0;
      width: min(230px, calc(100vw - 36px));
      border: 1px solid rgba(32, 25, 18, .14);
      border-radius: 8px;
      background: #fbf5e9;
      box-shadow: 0 18px 50px rgba(32, 25, 18, .15);
      overflow: hidden;
    }
    .pluto-mobile-menu-panel a {
      display: block;
      padding: 15px 18px;
      border-bottom: 1px solid rgba(32, 25, 18, .1);
      letter-spacing: .04em;
    }
    .pluto-mobile-menu-panel a:last-child { border-bottom: 0; }
    @media (max-width: 720px) {
      .pluto-site-header-shell {
        width: min(100% - 36px, 1480px);
        min-height: 66px;
      }
      .pluto-brand-logo { width: 64px; height: 50px; }
      .pluto-header-right { gap: 16px; }
      .pluto-header-nav { display: none; }
      .pluto-mobile-menu { display: block; }
    }
  </style>
  <header class="pluto-site-header" data-${HEADER_MARKER}>
    <div class="pluto-site-header-shell">
      <a class="pluto-brand-lockup" href="https://pluto.hk/zh/" aria-label="虾子曰">
        <img class="pluto-brand-logo" src="https://pluto.hk/brand/logo/xiazi-global-hot-topics.webp" alt="虾子曰" width="92" height="92" />
      </a>
      <div class="pluto-header-right">
        <nav class="pluto-header-nav" aria-label="Primary navigation">
          <a href="https://pluto.hk/zh/#stories">昨日世界</a>
          <a href="https://pluto.hk/zh/#archive">往期归档</a>
          <a href="https://pluto.hk/english-quote-log/" aria-current="page">英语句子</a>
          <a href="https://pluto.hk/zh/#about">关于我们</a>
        </nav>
        <a class="pluto-language-switcher" aria-label="Switch to English" href="https://pluto.hk/en/">
          <span class="active">中</span><span aria-hidden="true">/</span><span>EN</span>
        </a>
        <details class="pluto-mobile-menu">
          <summary>菜单<span aria-hidden="true">▾</span></summary>
          <div class="pluto-mobile-menu-panel">
            <a href="https://pluto.hk/zh/#stories">昨日世界</a>
            <a href="https://pluto.hk/english-quote-log/" aria-current="page">英语句子</a>
            <a href="https://pluto.hk/zh/#archive">往期归档</a>
            <a href="https://pluto.hk/zh/#about">关于我们</a>
          </div>
        </details>
      </div>
    </div>
  </header>`;

  return html.replace(/<body([^>]*)>/i, `<body$1>${header}`);
}
