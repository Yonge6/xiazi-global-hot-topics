import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { buildIssueFromBatch } from "../src/lib/studio/batch-publish";
import type { Issue } from "../src/types/content";

async function main() {
const root = process.cwd();
const issueDate = "2026-07-13";
const base = JSON.parse(await fs.readFile(path.join(root, "src/data/archive/2026-07-12.json"), "utf8")) as Issue;
const copy = await fs.readFile(path.join(root, "tmp/batch-copy-2026-07-13.txt"), "utf8");
const issue = buildIssueFromBatch(base, issueDate, copy, "Claymorphism 黏土风格");
const slugs = [
  "overview",
  "world-cup-july13-quarterfinals",
  "us-iran-hormuz-escalation-july13",
  "ukraine-azov-tanker",
  "europe-heatwave-excess-deaths",
  "south-china-sea-joint-statement",
  "apple-openai-trade-secrets",
  "israel-election-october27",
  "micron-us-investment-250b",
];

issue.assetVersion = `issue-${issueDate}-claymorphism-mobile-batch-v1`;
issue.topics = issue.topics.map((topic, index) => ({
  ...topic,
  slug: slugs[index],
  storyId: `xzs-${slugs[index]}-${issueDate.replaceAll("-", "")}`,
  storyStatus: index === 1 ? "followup" : "new",
  followupDay: index === 1 ? 2 : 1,
  informationIncrementScore: 100,
}));

const zhDir = "/Users/yongyuan/Downloads/中文";
const enDir = "/Users/yongyuan/Downloads/英文";
const selected = async (dir: string) => (await fs.readdir(dir))
  .filter((name) => name.endsWith(".png") && /\(([1-9])\)\.png$/.test(name))
  .sort((a, b) => Number(a.match(/\(([1-9])\)\.png$/)?.[1]) - Number(b.match(/\(([1-9])\)\.png$/)?.[1]));
const [zhFiles, enFiles] = await Promise.all([selected(zhDir), selected(enDir)]);
if (zhFiles.length !== 9 || enFiles.length !== 9) throw new Error(`Expected 9+9 posters, got ${zhFiles.length}+${enFiles.length}`);

let inputBytes = 0;
let outputBytes = 0;
for (const [locale, dir, files] of [["zh", zhDir, zhFiles], ["en", enDir, enFiles]] as const) {
  for (let index = 0; index < 9; index += 1) {
    const source = path.join(dir, files[index]);
    inputBytes += (await fs.stat(source)).size;
    const original = await fs.readFile(source);
    const candidate = await sharp(original).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    const compressed = candidate.length < original.length ? candidate : original;
    outputBytes += compressed.length;
    const destinations = [
      `public/posters/${locale}/${slugs[index]}.png`,
      `public/archive/${issueDate}/posters/${locale}/${slugs[index]}.png`,
      `apps/web/public/posters/${locale}/${slugs[index]}.png`,
      `apps/web/public/archive/${issueDate}/posters/${locale}/${slugs[index]}.png`,
    ];
    for (const relative of destinations) {
      const destination = path.join(root, relative);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, compressed);
    }
  }
}

const json = `${JSON.stringify(issue, null, 2)}\n`;
for (const relative of [
  "data/current-issue.json", "src/data/current-issue.json", "public/data/current-issue.json",
  "apps/web/data/current-issue.json", "apps/web/src/data/current-issue.json", "apps/web/public/data/current-issue.json",
  `data/archive/${issueDate}.json`, `src/data/archive/${issueDate}.json`, `public/data/archive/${issueDate}.json`,
  `apps/web/data/archive/${issueDate}.json`, `apps/web/src/data/archive/${issueDate}.json`, `apps/web/public/data/archive/${issueDate}.json`,
]) {
  const destination = path.join(root, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, json);
}

for (const relative of ["public/data/archive/index.json", "apps/web/public/data/archive/index.json"]) {
  const destination = path.join(root, relative);
  let dates: string[] = [];
  try { dates = JSON.parse(await fs.readFile(destination, "utf8")).issues || []; } catch {}
  dates = Array.from(new Set([issueDate, ...dates])).sort((a, b) => b.localeCompare(a));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, `${JSON.stringify({ issues: dates }, null, 2)}\n`);
}

console.log(JSON.stringify({
  issueDate: issue.issueDate,
  topics: issue.topics.map((topic) => topic.localizations["zh-CN"].headlineFull),
  posters: zhFiles.length + enFiles.length,
  inputBytes,
  outputBytes,
  ratio: Number((outputBytes / inputBytes).toFixed(3)),
}, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
