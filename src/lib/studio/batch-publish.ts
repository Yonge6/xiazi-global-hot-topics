import type { Issue, LocalizedTopic, Topic } from "@/types/content";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export type BatchStory = {
  rank: number;
  categoryLabel: string;
  zh: {
    title: string;
    intro: string;
    xiaziQuote: string;
    doudouQuote: string;
    source: string;
  };
  en: {
    title: string;
    intro: string;
    xiaziQuote: string;
    doudouQuote: string;
  };
};

function sectionValue(block: string, labels: string[], stopLabels: string[]) {
  const label = labels.map(escapeRegExp).join("|");
  const stops = stopLabels.map(escapeRegExp).join("|");
  const stop = stops ? `(?=\\n\\s*(?:${stops})\\s*[:：]|$)` : "$";
  const match = block.match(new RegExp(`(?:${label})\\s*[:：]\\s*([\\s\\S]*?)${stop}`, "i"));
  return clean(match?.[1] || "");
}

function clean(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[\s\-•]+|[\s\-•]+$/g, "")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitHeadline(title: string, locale: "zh-CN" | "en-US") {
  const trimmed = clean(title);
  const parts = trimmed.split(locale === "zh-CN" ? /[；;]/ : /;\s*/);
  const fact = clean(parts[0] || trimmed).replace(/[.。!?！？]+$/g, "");
  const view = clean(parts.slice(1).join(locale === "zh-CN" ? "；" : "; ")) || (locale === "zh-CN"
    ? "真正重要的是后续影响如何扩散"
    : "the real test is what happens next");
  const separator = locale === "zh-CN" ? "；" : "; ";
  const punctuation = locale === "zh-CN" ? "。" : ".";
  return {
    headlineFact: fact,
    headlineView: view,
    headlineFull: `${fact}${separator}${view}${/[.。!?！？]$/.test(view) ? "" : punctuation}`,
  };
}

function localized(
  categoryLabel: string,
  title: string,
  intro: string,
  xiaziQuote: string,
  doudouQuote: string,
  locale: "zh-CN" | "en-US",
): LocalizedTopic {
  const headline = splitHeadline(title, locale);
  return {
    categoryLabel,
    ...headline,
    intro,
    xiaziQuote,
    doudouQuote,
    footerTakeaway: locale === "zh-CN" ? `今日关键词：${categoryLabel}。` : `Keyword: ${categoryLabel}.`,
  };
}

function headerParts(header: string, fallback: string) {
  const withoutNo = clean(header.replace(/^NO\.?\s*0?[1-9]\s*/i, ""));
  const beginsWithSeparator = /^[｜|:：\-—]/.test(withoutNo);
  const segments = withoutNo.split(/\s*[｜|:：\-—]\s*/).map(clean).filter(Boolean);
  if (beginsWithSeparator) {
    return {
      category: segments[0] || fallback,
      title: clean(segments.slice(1).join("；")),
    };
  }
  const [category, ...rest] = segments;
  return {
    category: clean(category || fallback),
    title: clean(rest.join("；")),
  };
}

export function parseBatchCopy(copy: string): BatchStory[] {
  // Bold Markdown wrappers are presentation-only. Removing them up front lets
  // labels such as `**中文正文：**` use the same parser as plain text labels.
  const normalized = copy.replace(/\r/g, "").replace(/\*\*/g, "");
  // Mobile users commonly paste ChatGPT Markdown headings such as
  // `## NO.01｜今日总览`. Keep the marker anchored to a line start so a
  // numbered reference inside body copy cannot create a false story block.
  const matches = [...normalized.matchAll(/^\s{0,3}(?:#{1,6}\s*)?NO\.?\s*0?([1-9])\b[^\n]*/gim)];
  if (matches.length !== 9) {
    throw new Error(`文案需要刚好 9 条 NO.01-NO.09，目前识别到 ${matches.length} 条`);
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? normalized.length;
    const block = clean(normalized.slice(start, end));
    const rank = Number(match[1]);
    const fallbackCategory = rank === 1 ? "今日总览" : rank === 2 ? "世界杯" : `热点 ${rank}`;
    const header = clean(match[0].replace(/^\s*#{1,6}\s*/, ""));
    const parts = headerParts(header, fallbackCategory);
    const lines = block.split("\n").map(clean).filter(Boolean);
    const firstBodyLine = lines.find((line) => !/^NO\.?/i.test(line) && !/[:：]$/.test(line));

    const zhTitle = parts.title || sectionValue(block, ["中文标题", "中文题目", "标题"], [
      "中文正文", "正文", "English Version", "English", "英文标题", "英文正文", "推荐阅读来源", "虾子曰评价", "虾子曰洞察", "豆豆龙评价", "豆豆龙吐槽",
    ]) || firstBodyLine || parts.category;
    const zhIntro = sectionValue(block, ["中文正文", "正文", "中文"], [
      "English Version", "English", "英文标题", "英文正文", "推荐阅读来源", "虾子曰评价", "虾子曰洞察", "豆豆龙评价", "豆豆龙吐槽",
    ]) || zhTitle;
    const enTitle = sectionValue(block, ["English Title", "英文标题"], [
      "English Version", "English", "英文正文", "推荐阅读来源", "虾子曰评价", "虾子曰洞察", "豆豆龙评价", "豆豆龙吐槽",
    ]) || zhTitle;
    const enIntro = sectionValue(block, ["English Version", "English", "英文正文", "英文"], [
      "推荐阅读来源", "Source", "虾子曰评价", "虾子曰洞察", "豆豆龙评价", "豆豆龙吐槽",
    ]) || enTitle;
    const xiazi = sectionValue(block, ["虾子曰评价", "虾子曰洞察", "虾子曰"], ["豆豆龙评价", "豆豆龙吐槽", "豆豆龙", "推荐阅读来源", "Source"]) || "";
    const doudou = sectionValue(block, ["豆豆龙评价", "豆豆龙吐槽", "豆豆龙"], ["推荐阅读来源", "Source"]) || "";

    return {
      rank,
      categoryLabel: parts.category,
      zh: {
        title: zhTitle,
        intro: zhIntro,
        xiaziQuote: xiazi,
        doudouQuote: doudou,
        source: sectionValue(block, ["推荐阅读来源", "来源", "Source"], ["虾子曰评价", "虾子曰洞察", "豆豆龙评价", "豆豆龙吐槽"]) || "ChatGPT cited sources",
      },
      en: {
        title: enTitle,
        intro: enIntro,
        xiaziQuote: xiazi,
        doudouQuote: doudou,
      },
    };
  }).sort((a, b) => a.rank - b.rank);
}

export function sortPosterFiles(files: File[]) {
  return [...files].sort((a, b) => posterOrder(a.name) - posterOrder(b.name) || a.name.localeCompare(b.name, "zh-Hans-CN"));
}

export function posterOrder(name: string) {
  const no = name.match(/\bNO\.?\s*0?([1-9])\b/i) || name.match(/(?:^|[^0-9])0?([1-9])(?:[^0-9]|$)/);
  return no ? Number(no[1]) : 99;
}

export function buildIssueFromBatch(baseIssue: Issue, issueDate: string, copy: string, styleZhName?: string): Issue {
  if (!datePattern.test(issueDate)) throw new Error("刊期日期无效");
  if (baseIssue.topics.length !== 9) throw new Error("当前刊期不是 9 条，不能作为批量发布模板");

  const stories = parseBatchCopy(copy);
  const issueId = `issue-${issueDate}`;
  const topics: Topic[] = stories.map((story, index) => {
    const base = baseIssue.topics[index];
    const topicId = `${issueId}-topic-${String(index + 1).padStart(2, "0")}`;
    return {
      ...base,
      id: topicId,
      issueId,
      rank: index + 1,
      storyId: `${base.slug}_${issueDate.replaceAll("-", "_")}`,
      localizations: {
        "zh-CN": localized(story.categoryLabel, story.zh.title, story.zh.intro, story.zh.xiaziQuote, story.zh.doudouQuote, "zh-CN"),
        "en-US": localized(base.localizations["en-US"].categoryLabel || story.categoryLabel, story.en.title, story.en.intro, story.en.xiaziQuote, story.en.doudouQuote, "en-US"),
      },
      sources: [{
        id: `${topicId}-source-1`,
        topicId,
        title: story.zh.source,
        publisher: "ChatGPT cited sources",
        url: "https://chatgpt.com/share/6a3a3a5e-d3d8-83e8-aa7e-9df622aeff22",
        publishedAt: `${issueDate}T00:00:00Z`,
        sourceType: "publisher",
        sourceTier: 2,
        locale: "zh-CN",
        isPrimary: true,
      }],
    };
  });

  const next = {
    ...baseIssue,
    id: issueId,
    slug: issueDate,
    issueDate,
    assetVersion: `issue-${issueDate}-mobile-batch-${Date.now()}`,
    status: "published",
    beijingTimestamp: `${issueDate}T05:00:00+08:00`,
    gmtTimestamp: `${previousUtcDate(issueDate)}T21:00:00Z`,
    featuredTopicId: topics[0].id,
    topics,
  } as Issue & { style?: { name: string; zhName: string; description: string } };

  if (styleZhName) {
    next.style = {
      name: styleZhName,
      zhName: styleZhName,
      description: `${styleZhName} visual system for Xiazi global hot topics posters.`,
    };
  }
  return next;
}

function previousUtcDate(issueDate: string) {
  const date = new Date(`${issueDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
