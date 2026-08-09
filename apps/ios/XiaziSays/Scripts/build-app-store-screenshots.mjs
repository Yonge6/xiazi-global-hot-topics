import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "StoreAssets", "source");
const captures = path.join(root, "StoreAssets", "captures");
const output = path.join(root, "StoreAssets", "final", "screenshots");
const background = path.join(source, "screenshot-background-image2.png");
const width = 1284;
const height = 2778;

await fs.mkdir(path.join(output, "en"), { recursive: true });
await fs.mkdir(path.join(output, "zh-Hans"), { recursive: true });

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function headlineSvg(lines, eyebrow, subtitle, locale) {
  const serif = locale === "zh-Hans" ? "Songti SC, STSong, serif" : "Georgia, Times New Roman, serif";
  const titleSize = locale === "zh-Hans" ? 76 : 72;
  const lineGap = locale === "zh-Hans" ? 92 : 84;
  const title = lines.map((line, index) => (
    `<text x="92" y="${190 + index * lineGap}" font-family="${serif}" font-size="${titleSize}" font-weight="700" fill="#102f34">${escapeXml(line)}</text>`
  )).join("");
  const subtitleY = 230 + (lines.length - 1) * lineGap;
  return Buffer.from(`
    <svg width="${width}" height="430" xmlns="http://www.w3.org/2000/svg">
      <text x="94" y="74" font-family="Helvetica Neue, PingFang SC, sans-serif" font-size="22" font-weight="700" letter-spacing="5" fill="#b93427">${escapeXml(eyebrow)}</text>
      ${title}
      <text x="94" y="${subtitleY + 64}" font-family="Helvetica Neue, PingFang SC, sans-serif" font-size="29" fill="#52676a">${escapeXml(subtitle)}</text>
      <line x1="94" x2="1190" y1="${subtitleY + 108}" y2="${subtitleY + 108}" stroke="#b89963" stroke-width="2" opacity="0.75"/>
    </svg>
  `);
}

function labelSvg(left, top, text, accent = "#155f61") {
  return {
    input: Buffer.from(`
      <svg width="545" height="72" xmlns="http://www.w3.org/2000/svg">
        <rect width="545" height="72" rx="36" fill="#fffaf0" stroke="#d4b878" stroke-width="2"/>
        <text x="272.5" y="48" text-anchor="middle" font-family="Helvetica Neue, PingFang SC, sans-serif" font-size="27" font-weight="700" fill="${accent}">${escapeXml(text)}</text>
      </svg>
    `),
    left,
    top,
  };
}

async function base() {
  return sharp(background).resize(width, height, { fit: "cover" }).png().toBuffer();
}

async function roundedCapture(file, targetWidth, cropHeight = null) {
  const metadata = await sharp(file).metadata();
  const top = 144;
  const availableHeight = Math.max(1, (metadata.height ?? 2622) - top);
  const heightToUse = Math.min(cropHeight ?? availableHeight, availableHeight);
  const resized = await sharp(file)
    .extract({ left: 0, top, width: metadata.width ?? 1206, height: heightToUse })
    .resize({ width: targetWidth })
    .png()
    .toBuffer();
  const size = await sharp(resized).metadata();
  return sharp(resized)
    .composite([{ input: Buffer.from(`<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="46" fill="white"/></svg>`), blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function buildHome(locale, copy) {
  const screen = await roundedCapture(path.join(captures, locale === "en" ? "en" : "zh", "01-home.png"), 1050);
  await sharp(await base()).composite([
    { input: headlineSvg(copy.title, copy.eyebrow, copy.subtitle, locale), left: 0, top: 42 },
    { input: screen, left: 117, top: 480 },
  ]).flatten({ background: "#f4ead4" }).removeAlpha().png().toFile(path.join(output, locale, "01-daily-edition.png"));
}

async function buildPoster(locale, copy) {
  const captureLocale = locale === "en" ? "en" : "zh";
  const poster = await sharp(path.join(captures, captureLocale, "overview-poster.png"))
    .resize({ width: 900 })
    .png()
    .toBuffer();
  const posterMeta = await sharp(poster).metadata();
  const framed = await sharp({
    create: { width: 964, height: (posterMeta.height ?? 1800) + 64, channels: 4, background: "#fffaf0" },
  }).composite([{ input: poster, left: 32, top: 32 }]).png().toBuffer();
  await sharp(await base()).composite([
    { input: headlineSvg(copy.title, copy.eyebrow, copy.subtitle, locale), left: 0, top: 42 },
    { input: framed, left: 160, top: 590 },
  ]).flatten({ background: "#f4ead4" }).removeAlpha().png().toFile(path.join(output, locale, "02-visual-posters.png"));
}

async function buildBilingual(locale, copy) {
  const enScreen = await roundedCapture(path.join(captures, "en", "01-home.png"), 545);
  const zhScreen = await roundedCapture(path.join(captures, "zh", "01-home.png"), 545);
  await sharp(await base()).composite([
    { input: headlineSvg(copy.title, copy.eyebrow, copy.subtitle, locale), left: 0, top: 42 },
    labelSvg(72, 510, "ENGLISH"),
    labelSvg(667, 510, "中文", "#b93427"),
    { input: enScreen, left: 72, top: 608 },
    { input: zhScreen, left: 667, top: 608 },
  ]).flatten({ background: "#f4ead4" }).removeAlpha().png().toFile(path.join(output, locale, "03-bilingual-reading.png"));
}

const copy = {
  en: {
    home: { eyebrow: "XIAZI SAYS · DAILY", title: ["A CLEARER VIEW", "OF THE WORLD"], subtitle: "One overview and eight essential stories, every day." },
    poster: { eyebrow: "VISUAL EDITION", title: ["18 BILINGUAL", "NEWS POSTERS"], subtitle: "Save, study, and share the complete visual briefing." },
    bilingual: { eyebrow: "TWO LANGUAGES", title: ["READ IN ENGLISH", "OR CHINESE"], subtitle: "Switch languages without losing the day’s context." },
  },
  "zh-Hans": {
    home: { eyebrow: "虾子曰 · 每日刊物", title: ["每天看懂", "九件全球要事"], subtitle: "一张今日总览，八件重要全球热点。" },
    poster: { eyebrow: "视觉刊物", title: ["十八张中英双语", "新闻海报"], subtitle: "完整保存、阅读与分享当天的视觉简报。" },
    bilingual: { eyebrow: "双语阅读", title: ["中英文", "随时切换"], subtitle: "切换语言，也保留对同一天的完整理解。" },
  },
};

for (const locale of ["en", "zh-Hans"]) {
  await buildHome(locale, copy[locale].home);
  await buildPoster(locale, copy[locale].poster);
  await buildBilingual(locale, copy[locale].bilingual);
}

console.log(output);
