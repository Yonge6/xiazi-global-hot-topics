import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const issueSpecPath = process.env.ISSUE_SPEC;
const posterRoot = process.env.POSTER_ROOT;

if (!issueSpecPath || !posterRoot) {
  throw new Error("ISSUE_SPEC and POSTER_ROOT are required");
}

const spec = JSON.parse(await fs.readFile(issueSpecPath, "utf8"));
const issueDate = spec.issueDate;
const stories = spec.stories;
if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || stories.length !== 9) {
  throw new Error("Expected a dated issue with exactly 9 stories");
}

const writeJson = async (relativePath, value) => {
  const outputPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`);
};

const localized = (story, locale) => {
  const copy = locale === "zh-CN" ? story.zh : story.en;
  return {
    categoryLabel: copy.categoryLabel,
    headlineFact: copy.headlineFact,
    headlineView: copy.headlineView,
    headlineFull: `${copy.headlineFact}${locale === "zh-CN" ? "；" : "; "}${copy.headlineView}`,
    intro: copy.intro,
    xiaziQuote: copy.xiaziQuote,
    doudouQuote: copy.doudouQuote,
    footerTakeaway:
      locale === "zh-CN"
        ? `今日关键词：${copy.categoryLabel}。`
        : `Keyword: ${copy.categoryLabel}.`,
  };
};

const base = JSON.parse(
  await fs.readFile(path.join(root, "data/archive/2026-07-20.json"), "utf8"),
);
const issueId = `issue-${issueDate}`;
const topics = stories.map((story, index) => {
  const id = `topic-${issueDate}-${String(index + 1).padStart(2, "0")}`;
  return {
    ...base.topics[index],
    id,
    issueId,
    slug: story.slug,
    rank: story.rank,
    category: story.category,
    region: story.region,
    countryCodes: story.countryCodes,
    eventTime: null,
    isDeveloping: story.storyStatus === "followup",
    verificationStatus: "verified",
    scoreTotal: 98 - index,
    storyId: story.storyId,
    storyStatus: story.storyStatus,
    followupDay: story.followupDay,
    informationIncrementScore: story.informationIncrementScore,
    localizations: {
      "zh-CN": localized(story, "zh-CN"),
      "en-US": localized(story, "en-US"),
    },
    sources: story.sources.map((source, sourceIndex) => ({
      id: `source-${issueDate}-${String(index + 1).padStart(2, "0")}-${sourceIndex + 1}`,
      topicId: id,
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      publishedAt: `${issueDate}T00:00:00Z`,
      sourceType: source.sourceType === "media" ? "publisher" : source.sourceType,
      sourceTier: source.sourceType === "official" ? 1 : 2,
      locale: "en-US",
      isPrimary: sourceIndex === 0,
    })),
  };
});

const issue = {
  ...base,
  id: issueId,
  slug: issueDate,
  issueDate,
  assetVersion: `issue-${issueDate}-style-atlas-099-image2-v1`,
  status: "published",
  slotHour: 5,
  beijingTimestamp: `${issueDate}T05:00:00+08:00`,
  gmtTimestamp: "2026-07-20T21:00:00Z",
  featuredTopicId: topics[0].id,
  style: {
    name: "Style Atlas #99 Isometric Illustration",
    zhName: "Style Atlas #99 等距插画风格",
    description:
      "Sunlit premium isometric editorial miniatures on warm ivory, with precise stepped geometry, navy and terracotta accents, realistic materials and clear hierarchy.",
  },
  topics,
};

const compression = [];
for (const locale of ["zh", "en"]) {
  for (const [index, story] of stories.entries()) {
    const number = String(index + 1).padStart(2, "0");
    const sourcePath = path.join(posterRoot, locale, `NO.${number}.png`);
    const input = await fs.readFile(sourcePath);
    const before = await sharp(input).metadata();
    const output = await sharp(input)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    const after = await sharp(output).metadata();
    if (
      before.width !== 887 ||
      before.height !== 1774 ||
      after.width !== 887 ||
      after.height !== 1774 ||
      after.format !== "png"
    ) {
      throw new Error(`Poster transform failed for ${locale} NO.${number}`);
    }
    compression.push({
      locale,
      number: index + 1,
      before: input.length,
      after: output.length,
      width: after.width,
      height: after.height,
    });
    for (const relativePath of [
      `public/posters/${locale}/${story.slug}.png`,
      `public/archive/${issueDate}/posters/${locale}/${story.slug}.png`,
      `apps/web/public/posters/${locale}/${story.slug}.png`,
      `apps/web/public/archive/${issueDate}/posters/${locale}/${story.slug}.png`,
    ]) {
      const outputPath = path.join(root, relativePath);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, output);
    }
  }
}

const dataRoots = [
  "data",
  "src/data",
  "public/data",
  "apps/web/data",
  "apps/web/src/data",
  "apps/web/public/data",
];
for (const dataRoot of dataRoots) {
  await writeJson(`${dataRoot}/current-issue.json`, issue);
  await writeJson(`${dataRoot}/archive/${issueDate}.json`, issue);
}

const storyPool = JSON.parse(
  await fs.readFile(path.join(root, "data/story-pool.json"), "utf8"),
);
for (const topic of topics.slice(1)) {
  const existing = storyPool.find((entry) => entry.storyId === topic.storyId);
  const next = {
    storyId: topic.storyId,
    storyStatus: topic.storyStatus,
    followupDay: topic.followupDay,
    informationIncrementScore: topic.informationIncrementScore,
    firstSeenDate: existing?.firstSeenDate || issueDate,
    lastSeenDate: issueDate,
    lastIssueDate: issueDate,
    lastTopicSlug: topic.slug,
    slug: topic.slug,
  };
  if (existing) Object.assign(existing, next);
  else storyPool.push(next);
}
for (const dataRoot of dataRoots) {
  await writeJson(`${dataRoot}/story-pool.json`, storyPool);
}

for (const relativePath of [
  "public/data/archive/index.json",
  "apps/web/public/data/archive/index.json",
]) {
  const archiveIndex = JSON.parse(
    await fs.readFile(path.join(root, relativePath), "utf8"),
  );
  archiveIndex.issues = Array.from(
    new Set([issueDate, ...(archiveIndex.issues || [])]),
  ).sort((a, b) => b.localeCompare(a));
  await writeJson(relativePath, archiveIndex);
}

await writeJson(`tmp/daily-fallback-${issueDate}/compression-report.json`, compression);
await writeJson(
  `tmp/daily-fallback-${issueDate}/selected-stories.json`,
  stories.map((story) => ({
    rank: story.rank,
    slug: story.slug,
    storyId: story.storyId,
    storyStatus: story.storyStatus,
    zhTitle: story.zh.posterTitle,
    enTitle: story.en.posterTitle,
    sources: story.sources,
  })),
);

console.log(
  JSON.stringify(
    {
      issueDate,
      topicCount: topics.length,
      posterCount: compression.length,
      compression:
        "Sharp PNG lossless; 887x1774 preserved; thumbnails generated: 0",
      totalBefore: compression.reduce((sum, item) => sum + item.before, 0),
      totalAfter: compression.reduce((sum, item) => sum + item.after, 0),
    },
    null,
    2,
  ),
);
