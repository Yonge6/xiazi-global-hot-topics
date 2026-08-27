import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const here = path.dirname(fileURLToPath(import.meta.url));
const sources = path.join(here, "source", "image2-screenshots");
const output = path.join(here, "final", "screenshots");
const iconPath = path.join(here, "final", "app-icon-1024.png");

const width = 1284;
const height = 2778;
const ink = "#0D3B4C";
const vermilion = "#C9482E";
const gold = "#C3944D";
const muted = "#526D73";

const slides = [
  {
    source: "01-world.png",
    file: "01-daily-edition.png",
    en: { kicker: "XIAZI SAYS · DAILY EDITION", title: ["THE WORLD,", "CLEARER."], body: "1 Daily Overview · 8 Global Stories" },
    zh: { kicker: "虾子曰 · 每日刊物", title: ["把世界，", "看清楚。"], body: "1 张今日总览 · 8 件全球热点" },
  },
  {
    source: "02-posters.png",
    file: "02-visual-posters.png",
    en: { kicker: "XIAZI SAYS · VISUAL EDITION", title: ["18 BILINGUAL", "VISUAL POSTERS"], body: "Save the complete visual briefing." },
    zh: { kicker: "虾子曰 · 视觉刊物", title: ["18 张中英双语", "视觉海报"], body: "保存完整的视觉简报" },
  },
  {
    source: "03-bilingual.png",
    file: "03-bilingual-reading.png",
    en: { kicker: "XIAZI SAYS · BILINGUAL", title: ["READ IN", "YOUR LANGUAGE."], body: "Chinese and English, side by side." },
    zh: { kicker: "虾子曰 · 双语阅读", title: ["用你的语言", "阅读世界"], body: "中文与英文，随时切换" },
  },
  {
    source: "04-style-atlas.png",
    file: "04-daily-style.png",
    en: { kicker: "XIAZI SAYS · STYLE ATLAS", title: ["A NEW VISUAL STYLE,", "EVERY DAY."], body: "A fresh art direction for every edition." },
    zh: { kicker: "虾子曰 · 艺术风格图鉴", title: ["每天一种", "视觉风格"], body: "每期都有全新的艺术表达" },
  },
  {
    source: "05-save-share.png",
    file: "05-save-and-share.png",
    en: { kicker: "XIAZI SAYS · YOUR COLLECTION", title: ["KEEP THE STORIES", "THAT MATTER."], body: "Save and share what you want to remember." },
    zh: { kicker: "虾子曰 · 你的收藏", title: ["把重要的世界", "留下来"], body: "保存与分享值得记住的故事" },
  },
];

const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function titleOverlay(copy, index, locale) {
  const isZh = locale === "zh-Hans";
  const titleSize = isZh ? 106 : copy.title[0].length > 18 ? 78 : 96;
  const titleSpacing = isZh ? 2 : 1;
  const titleFamily = "Noto Serif SC, Songti SC, STSong, Iowan Old Style, Times New Roman, serif";
  const metaFamily = "Noto Sans SC, PingFang SC, Helvetica Neue, sans-serif";
  const bodySize = isZh ? 34 : 32;
  const lineGap = isZh ? 126 : 112;
  const startY = isZh ? 326 : 318;
  const title = copy.title.map((line, i) => `<tspan x="86" y="${startY + i * lineGap}">${escapeXml(line)}</tspan>`).join("");

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="218" y="163" fill="${vermilion}" font-family="${metaFamily}" font-size="24" font-weight="700" letter-spacing="4">${escapeXml(copy.kicker)}</text>
      <text x="1194" y="163" text-anchor="end" fill="${gold}" font-family="${metaFamily}" font-size="22" font-weight="600" letter-spacing="3">0${index} / 05</text>
      <text fill="${ink}" font-family="${titleFamily}" font-size="${titleSize}" font-weight="700" letter-spacing="${titleSpacing}">${title}</text>
      <text x="88" y="${startY + lineGap * 2 + 34}" fill="${muted}" font-family="${titleFamily}" font-size="${bodySize}" font-weight="400" letter-spacing="${isZh ? 1 : 0.4}">${escapeXml(copy.body)}</text>
      <line x1="88" y1="${startY + lineGap * 2 + 104}" x2="1196" y2="${startY + lineGap * 2 + 104}" stroke="${gold}" stroke-width="2" opacity="0.72"/>
      <circle cx="88" cy="${startY + lineGap * 2 + 104}" r="5" fill="${vermilion}"/>
    </svg>
  `);
}

async function roundedIcon() {
  const size = 104;
  const mask = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="24" fill="white"/></svg>`);
  return sharp(iconPath).resize(size, size).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

await fs.mkdir(path.join(output, "en"), { recursive: true });
await fs.mkdir(path.join(output, "zh-Hans"), { recursive: true });
const icon = await roundedIcon();

for (const [position, slide] of slides.entries()) {
  const base = await sharp(path.join(sources, slide.source))
    .resize(width, height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  for (const locale of ["en", "zh-Hans"]) {
    const copy = locale === "en" ? slide.en : slide.zh;
    const destination = path.join(output, locale, slide.file);
    await sharp(base)
      .composite([
        { input: icon, top: 92, left: 86 },
        { input: titleOverlay(copy, position + 1, locale), top: 0, left: 0 },
      ])
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(destination);
  }
}

console.log(`Built ${slides.length * 2} screenshots at ${width}x${height}.`);
