import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const posterNames = [
  "world-cup",
  "supply-chain",
  "ai-governance",
  "public-health",
  "cultural-heritage",
  "clean-energy",
  "high-seas",
  "space-orbit",
  "climate-adaptation",
];

const secretId = process.env.COS_SECRET_ID;
const secretKey = process.env.COS_SECRET_KEY;
const bucket = process.env.COS_BUCKET;
const region = process.env.COS_REGION;
const issueDate = process.env.ISSUE_DATE;
const source = path.join(process.cwd(), "public/posters/default-poster.jpg");

if (!secretId || !secretKey || !bucket || !region) {
  throw new Error("COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET and COS_REGION are required");
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate || "")) {
  throw new Error("ISSUE_DATE must use YYYY-MM-DD");
}

function hmacSha1(key, value) {
  return createHmac("sha1", key).update(value).digest("hex");
}

function sha1(value) {
  return createHash("sha1").update(value).digest("hex");
}

async function upload(key, content, contentType) {
  const host = `${bucket}.cos.${region}.myqcloud.com`;
  const pathname = `/${key.split("/").map(encodeURIComponent).join("/")}`;
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now - 60};${now + 3600}`;
  const httpString = `put\n${pathname}\n\nhost=${host}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`;
  const signature = hmacSha1(hmacSha1(secretKey, keyTime), stringToSign);
  const authorization = [
    "q-sign-algorithm=sha1",
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    "q-header-list=host",
    "q-url-param-list=",
    `q-signature=${signature}`,
  ].join("&");

  const response = await fetch(`https://${host}${pathname}`, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    },
    body: content,
  });
  if (!response.ok) throw new Error(`${key}: ${response.status} ${await response.text()}`);
}

const originalJpeg = await readFile(source);
const original = await sharp(originalJpeg).png({ compressionLevel: 9 }).toBuffer();
const thumbnail = await sharp(originalJpeg)
  .resize({ width: 480, withoutEnlargement: true })
  .webp({ quality: 76, effort: 5 })
  .toBuffer();

for (const locale of ["zh", "en"]) {
  for (const name of posterNames) {
    await Promise.all([
      upload(`posters/${locale}/${name}.png`, original, "image/png"),
      upload(`posters/thumb/${locale}/${name}.webp`, thumbnail, "image/webp"),
      upload(`archive/${issueDate}/posters/${locale}/${name}.png`, original, "image/png"),
      upload(`archive/${issueDate}/posters/thumb/${locale}/${name}.webp`, thumbnail, "image/webp"),
    ]);
  }
}

console.log(`Default posters uploaded for ${issueDate}`);
