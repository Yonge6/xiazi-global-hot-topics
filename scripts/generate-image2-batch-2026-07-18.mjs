import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const manifestPath = path.join(root, "tmp/daily-fallback-2026-07-18/image2-prompts.json");
const genScript = "/Users/yongyuan/.codex/skills/gpt-image-2/scripts/gen.sh";
const refs = [
  path.join(root, "public/brand/characters/xiazi/xiazi-master-front.png"),
  path.join(root, "public/brand/characters/doudou/doudou-master-front.png"),
];

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", args, { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Image2 generator exited ${code}`)));
  });
}

async function validate(file) {
  const metadata = await sharp(file).metadata();
  if (metadata.format !== "png" || !metadata.width || !metadata.height) {
    throw new Error(`Not a readable PNG: ${file}`);
  }
  const ratio = metadata.width / metadata.height;
  if (metadata.width < 800 || metadata.height < 1500 || ratio < 0.45 || ratio > 0.56) {
    throw new Error(`Poster has invalid dimensions ${metadata.width}x${metadata.height}: ${file}`);
  }
  return metadata;
}

const items = JSON.parse(await fs.readFile(manifestPath, "utf8"));
for (const [index, item] of items.entries()) {
  await fs.mkdir(path.dirname(item.output), { recursive: true });
  try {
    const existing = await validate(item.output);
    console.log(`[${index + 1}/${items.length}] KEEP ${item.locale} NO.${String(item.number).padStart(2, "0")} ${existing.width}x${existing.height}`);
    continue;
  } catch {}

  console.log(`[${index + 1}/${items.length}] GENERATE ${item.locale} NO.${String(item.number).padStart(2, "0")} -> ${item.output}`);
  await run([
    genScript,
    "--prompt", item.prompt,
    "--ref", refs[0],
    "--ref", refs[1],
    "--model", "gpt-5.5",
    "--out", item.output,
    "--timeout-sec", "420",
  ]);
  const metadata = await validate(item.output);
  console.log(`[${index + 1}/${items.length}] PASS ${item.locale} NO.${String(item.number).padStart(2, "0")} ${metadata.width}x${metadata.height}`);
}

console.log(JSON.stringify({ generatedOrKept: items.length, order: "9 Chinese then 9 English", modelRoute: "Codex gpt-5.5 to GPT Image 2 via gpt-image-2 skill", references: refs }, null, 2));
