import { createHash, createHmac } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const secretId = process.env.COS_SECRET_ID;
const secretKey = process.env.COS_SECRET_KEY;
const bucket = process.env.COS_BUCKET;
const region = process.env.COS_REGION;
const sourceRoot = process.env.POSTER_SOURCE_ROOT || path.join(process.cwd(), "public");

if (!secretId || !secretKey || !bucket || !region) {
  throw new Error("COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET and COS_REGION are required");
}

function hmacSha1(key, value) {
  return createHmac("sha1", key).update(value).digest("hex");
}

function sha1(value) {
  return createHash("sha1").update(value).digest("hex");
}

async function upload(key, filePath) {
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
  const content = await readFile(filePath);
  const contentType = filePath.endsWith(".webp") ? "image/webp" : "image/png";
  const response = await fetch(`https://${host}${pathname}`, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: content,
  });
  if (!response.ok) {
    throw new Error(`${key}: ${response.status} ${await response.text()}`);
  }
  console.log(`Uploaded ${key} (${content.length} bytes)`);
}

for (const locale of ["zh", "en"]) {
  for (const folder of ["posters", "posters/thumb"]) {
    const directory = path.join(sourceRoot, folder, locale);
    const files = (await readdir(directory))
      .filter((file) => file.endsWith(folder === "posters" ? ".png" : ".webp"))
      .sort();
    for (const file of files) {
      await upload(`${folder}/${locale}/${file}`, path.join(directory, file));
    }
  }
}
