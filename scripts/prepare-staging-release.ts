import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { stagingRehearsalIssue } from "../apps/web/src/server/releases/staging-rehearsal-fixture";
import { uploadImmutableReleasePosters } from "../apps/web/src/server/storage/immutable-upload-service";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`STAGING_FIXTURE_CONFIG_MISSING:${name}`);
  return value;
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function lines(value: string, locale: "zh" | "en") {
  if (locale === "zh") {
    const chars = [...value];
    return Array.from({ length: Math.ceil(chars.length / 16) }, (_, index) => chars.slice(index * 16, index * 16 + 16).join(""));
  }
  const words = value.split(/\s+/);
  const result: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > 28) {
      result.push(current);
      current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) result.push(current);
  return result;
}

async function main() {
const sourceOrigin = new URL(required("STAGING_WEB_URL")).origin;
const issueDate = required("STAGING_ISSUE_DATE");
const assetBatchId = required("STAGING_ASSET_BATCH_ID");
const output = required("STAGING_RELEASE_PAYLOAD_OUTPUT");
const variant = process.env.STAGING_RELEASE_VARIANT || "A";
if (process.env.RELEASE_ENVIRONMENT !== "staging" || !assetBatchId.startsWith("asset_staging_")) {
  throw new Error("STAGING_FIXTURE_GUARD_FAILED");
}
const issue = stagingRehearsalIssue({ issueDate, sourceOrigin });
const xiazi = await sharp(path.resolve("public/brand/characters/xiazi/xiazi-master-front.png"))
  .resize({ width: 270, height: 330, fit: "contain" }).png().toBuffer();
const doudou = await sharp(path.resolve("public/brand/characters/doudou/doudou-master-front.png"))
  .resize({ width: 250, height: 310, fit: "contain" }).png().toBuffer();
const logo = await sharp(path.resolve("public/brand/logo/xiazi-global-hot-topics.png"))
  .resize({ width: 190, height: 190, fit: "contain" }).png().toBuffer();
const palettes = [
  ["#082f49", "#f97316"], ["#312e81", "#22d3ee"], ["#3f1d2e", "#facc15"],
  ["#134e4a", "#fb7185"], ["#422006", "#38bdf8"], ["#1e3a8a", "#f59e0b"],
  ["#4a044e", "#34d399"], ["#172554", "#fb7185"], ["#052e16", "#fbbf24"],
];
const uploads = [];
for (const topic of issue.topics) {
  for (const locale of ["zh", "en"] as const) {
    const [background, accent] = palettes[topic.rank - 1];
    const title = locale === "zh" ? topic.localizations["zh-CN"].headlineFact : topic.localizations["en-US"].headlineFact;
    const titleLines = lines(title, locale).slice(0, 6);
    const titleMarkup = titleLines.map((line, index) => `<text x="78" y="${600 + index * 105}" font-size="${locale === "zh" ? 72 : 62}" font-weight="700" fill="#fff">${escapeXml(line)}</text>`).join("");
    const pattern = Array.from({ length: topic.rank + (variant === "B" ? 3 : 0) }, (_, index) => {
      const x = 80 + ((index * 173 + topic.rank * 41) % 900);
      const y = 260 + ((index * 227 + topic.rank * 83) % 1250);
      return `<circle cx="${x}" cy="${y}" r="${34 + (index % 4) * 13}" fill="none" stroke="${accent}" stroke-width="8" opacity="0.28"/>`;
    }).join("");
    const svg = Buffer.from(`<svg width="1080" height="2160" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="2160" fill="${background}"/>
      <rect x="42" y="42" width="996" height="2076" rx="36" fill="none" stroke="${accent}" stroke-width="6"/>
      ${pattern}
      <text x="78" y="170" font-size="42" font-weight="700" letter-spacing="4" fill="${accent}">虾子曰全球热点海报</text>
      <text x="78" y="260" font-size="78" font-weight="800" fill="#fff">NO.${String(topic.rank).padStart(2, "0")}</text>
      <text x="78" y="330" font-size="30" font-weight="700" letter-spacing="3" fill="#fff">STAGING ONLY · RELEASE ${variant}</text>
      <line x1="78" x2="1002" y1="390" y2="390" stroke="${accent}" stroke-width="4"/>
      ${titleMarkup}
      <rect x="74" y="1280" width="932" height="210" rx="24" fill="#ffffff" opacity="0.12"/>
      <text x="105" y="1360" font-size="34" fill="#fff">${locale === "zh" ? "仅用于隔离环境的技术演练" : "ISOLATED TECHNICAL REHEARSAL"}</text>
      <text x="105" y="1425" font-size="30" fill="${accent}">${issueDate} · xiazishuo.com</text>
      <text x="540" y="2055" text-anchor="middle" font-size="30" fill="#fff" opacity="0.85">Direct COS Origin · immutable asset</text>
    </svg>`);
    const content = await sharp(svg)
      .composite([
        { input: logo, left: 810, top: 95 },
        { input: xiazi, left: 85, top: 1620 },
        { input: doudou, left: 745, top: 1635 },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();
    uploads.push({ topicId: topic.id, locale, content });
  }
}

const uploaded = await uploadImmutableReleasePosters(issue, assetBatchId, uploads, {
  uploaderVersion: `xiazi-staging-rehearsal-${variant.toLowerCase()}-v1`,
});
const payload = {
  issue,
  posters: uploaded.posters,
  assetBatchId,
  idempotencyKey: `staging-${issueDate}-${variant.toLowerCase()}-${assetBatchId}`,
  leaseOwner: `staging-rehearsal-${variant.toLowerCase()}`,
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({
  issueDate,
  assetBatchId,
  variant,
  createdCount: uploaded.createdCount,
  idempotentCount: uploaded.idempotentCount,
  objectManifestHash: uploaded.objectManifestHash,
  payload: output,
}, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
