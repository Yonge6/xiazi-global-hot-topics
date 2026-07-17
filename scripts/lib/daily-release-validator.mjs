const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedStoryStatuses = new Set(["new", "followup", "finished"]);

function error(id, message, path) {
  return { id, message, ...(path ? { path } : {}) };
}

function nonEmpty(value, min = 1) {
  return typeof value === "string" && value.trim().length >= min;
}

function duplicateValues(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

export function beijingDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

/**
 * @param {Record<string, any>} issue
 * @param {{ expectedDate?: string, strictSchedule?: boolean }} [options]
 */
export function validateIssue(issue, options = {}) {
  const { expectedDate, strictSchedule = true } = options;
  const errors = [];

  if (!issue || typeof issue !== "object" || Array.isArray(issue)) {
    return [error("ISSUE-000", "Issue payload must be a JSON object")];
  }

  const issueDate = issue.issueDate;
  if (!datePattern.test(issueDate || "")) {
    errors.push(error("ISSUE-001", "issueDate must use YYYY-MM-DD", "issueDate"));
  }
  if (expectedDate && issueDate !== expectedDate) {
    errors.push(error("ISSUE-002", `Expected issueDate ${expectedDate}, received ${issueDate || "missing"}`, "issueDate"));
  }
  if (issue.status !== "published") {
    errors.push(error("ISSUE-003", "Issue status must be published", "status"));
  }
  if (!nonEmpty(issue.assetVersion, 6)) {
    errors.push(error("ISSUE-004", "assetVersion must be present so clients can refresh poster bytes", "assetVersion"));
  }
  if (issue.slug !== issueDate) {
    errors.push(error("ISSUE-005", "Issue slug must equal issueDate", "slug"));
  }

  if (strictSchedule && datePattern.test(issueDate || "")) {
    if (issue.slotHour !== 5) {
      errors.push(error("SCHEDULE-001", "slotHour must be 5 for the 05:00 Beijing release", "slotHour"));
    }
    if (issue.beijingTimestamp !== `${issueDate}T05:00:00+08:00`) {
      errors.push(error("SCHEDULE-002", "beijingTimestamp must be the issue date at 05:00 +08:00", "beijingTimestamp"));
    }
    const beijingInstant = Date.parse(issue.beijingTimestamp || "");
    const gmtInstant = Date.parse(issue.gmtTimestamp || "");
    if (!Number.isFinite(beijingInstant) || !Number.isFinite(gmtInstant) || beijingInstant !== gmtInstant) {
      errors.push(error("SCHEDULE-003", "beijingTimestamp and gmtTimestamp must describe the same instant", "gmtTimestamp"));
    }
  }

  if (!Array.isArray(issue.topics)) {
    return [...errors, error("TOPIC-001", "topics must be an array", "topics")];
  }
  if (issue.topics.length !== 9) {
    errors.push(error("TOPIC-002", `Exactly 9 topics are required; received ${issue.topics.length}`, "topics"));
  }

  const topics = [...issue.topics].sort((a, b) => (a?.rank || 0) - (b?.rank || 0));
  const ranks = topics.map((topic) => topic?.rank);
  if (JSON.stringify(ranks) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    errors.push(error("TOPIC-003", `Topic ranks must be exactly 1-9; received ${ranks.join(", ")}`, "topics"));
  }

  for (const field of ["id", "slug", "storyId"]) {
    const duplicates = duplicateValues(topics.map((topic) => topic?.[field]));
    if (duplicates.length > 0) {
      errors.push(error(field === "storyId" ? "STORY-001" : "TOPIC-004", `Topic ${field} values must be present and unique`, `topics.${field}`));
    }
  }

  const fixedSlots = [
    { rank: 1, id: "SLOT-001", zh: /总览/, en: /overview/i },
    { rank: 2, id: "SLOT-002", zh: /世界杯/, en: /world cup/i },
    { rank: 3, id: "SLOT-003", zh: /人工智能|\bAI\b/i, en: /artificial intelligence|\bAI\b/i },
    { rank: 4, id: "SLOT-004", zh: /一人公司|\bOPC\b/i, en: /one[- ]person|solo|\bOPC\b/i },
  ];

  for (const slot of fixedSlots) {
    const topic = topics.find((candidate) => candidate?.rank === slot.rank);
    const zhLabel = topic?.localizations?.["zh-CN"]?.categoryLabel || "";
    const enLabel = topic?.localizations?.["en-US"]?.categoryLabel || "";
    if (!slot.zh.test(zhLabel) || !slot.en.test(enLabel)) {
      errors.push(error(slot.id, `NO.${String(slot.rank).padStart(2, "0")} has the wrong fixed category labels`, `topics[${slot.rank - 1}].localizations`));
    }
  }

  for (const topic of topics.filter((candidate) => candidate?.rank >= 5)) {
    const labels = `${topic?.localizations?.["zh-CN"]?.categoryLabel || ""} ${topic?.localizations?.["en-US"]?.categoryLabel || ""}`;
    if (/人工智能|artificial intelligence|\bAI\b/i.test(labels) || /一人公司|one[- ]person|\bOPC\b/i.test(labels)) {
      errors.push(error("SLOT-005", `NO.${String(topic.rank).padStart(2, "0")} duplicates the reserved AI or OPC lane`, `topics[${topic.rank - 1}]`));
    }
  }

  const independentTopics = topics.filter((topic) => topic?.rank >= 2 && topic?.rank <= 9);
  const newCount = independentTopics.filter((topic) => topic?.storyStatus === "new").length;
  const followupCount = independentTopics.filter((topic) => topic?.storyStatus === "followup").length;
  if (newCount < 6) errors.push(error("MIX-001", `At least 6 of NO.02-NO.09 must be new; received ${newCount}`, "topics"));
  if (followupCount > 3) errors.push(error("MIX-002", `At most 3 of NO.02-NO.09 may be followup; received ${followupCount}`, "topics"));

  for (const topic of topics) {
    const prefix = `topics[${Math.max(0, (topic?.rank || 1) - 1)}]`;
    if (!slugPattern.test(topic?.slug || "")) {
      errors.push(error("TOPIC-005", `Topic rank ${topic?.rank || "?"} has an unsafe slug`, `${prefix}.slug`));
    }
    if (topic?.verificationStatus !== "verified") {
      errors.push(error("FACT-001", `Topic ${topic?.slug || "unknown"} is not verified`, `${prefix}.verificationStatus`));
    }
    if (!allowedStoryStatuses.has(topic?.storyStatus)) {
      errors.push(error("STORY-002", `Topic ${topic?.slug || "unknown"} has an invalid storyStatus`, `${prefix}.storyStatus`));
    }
    if (topic?.storyStatus === "finished") {
      errors.push(error("STORY-003", `Finished story ${topic?.storyId || topic?.slug} cannot be published`, `${prefix}.storyStatus`));
    }
    if (topic?.storyStatus === "followup" && Number(topic?.informationIncrementScore) < 60) {
      errors.push(error("STORY-004", `Followup ${topic?.storyId || topic?.slug} has information increment below 60`, `${prefix}.informationIncrementScore`));
    }
    if (!Number.isFinite(Number(topic?.informationIncrementScore)) || Number(topic?.informationIncrementScore) < 0 || Number(topic?.informationIncrementScore) > 100) {
      errors.push(error("STORY-005", `Topic ${topic?.storyId || topic?.slug} needs an informationIncrementScore from 0 to 100`, `${prefix}.informationIncrementScore`));
    }
    if (!Number.isInteger(topic?.followupDay) || topic.followupDay < 1) {
      errors.push(error("STORY-006", `Topic ${topic?.storyId || topic?.slug} needs a positive followupDay`, `${prefix}.followupDay`));
    }

    const zh = topic?.localizations?.["zh-CN"];
    const en = topic?.localizations?.["en-US"];
    if (!zh || !en) {
      errors.push(error("COPY-001", `Topic ${topic?.slug || "unknown"} requires zh-CN and en-US copy`, `${prefix}.localizations`));
    } else {
      const required = ["categoryLabel", "headlineFact", "headlineView", "headlineFull", "intro", "xiaziQuote", "doudouQuote", "footerTakeaway"];
      for (const field of required) {
        if (!nonEmpty(zh[field], field === "intro" ? 40 : 4) || !nonEmpty(en[field], field === "intro" ? 40 : 4)) {
          errors.push(error("COPY-001", `Topic ${topic.slug} has a missing or too-short bilingual ${field}`, `${prefix}.localizations.${field}`));
        }
      }
      if (!zh.headlineFull?.includes("；") || !zh.headlineFull?.startsWith(zh.headlineFact || "") || !zh.headlineFull?.includes(zh.headlineView || "")) {
        errors.push(error("COPY-002", `Chinese headline for ${topic.slug} must use the exact Fact；View structure`, `${prefix}.localizations.zh-CN.headlineFull`));
      }
      if (!en.headlineFull?.includes(";") || !en.headlineFull?.startsWith(en.headlineFact || "") || !en.headlineFull?.includes(en.headlineView || "")) {
        errors.push(error("COPY-003", `English headline for ${topic.slug} must use the Fact; View structure`, `${prefix}.localizations.en-US.headlineFull`));
      }
      if (!/[\u3400-\u9fff]/u.test(`${zh.headlineFull || ""}${zh.intro || ""}`)) {
        errors.push(error("COPY-004", `Chinese copy for ${topic.slug} must contain Chinese text`, `${prefix}.localizations.zh-CN`));
      }
      if (/[\u3400-\u9fff]{8,}/u.test(`${en.headlineFull || ""}${en.intro || ""}`)) {
        errors.push(error("COPY-005", `English copy for ${topic.slug} contains a long Chinese fragment`, `${prefix}.localizations.en-US`));
      }
      if (/English\s*(?:Title|Version)|英文(?:标题|版本)/i.test(`${zh.headlineFull || ""} ${zh.intro || ""}`)) {
        errors.push(error("COPY-006", `Chinese copy for ${topic.slug} leaks an English-version label`, `${prefix}.localizations.zh-CN`));
      }
    }

    if (!Array.isArray(topic?.sources) || topic.sources.length < 1) {
      errors.push(error("SOURCE-001", `Topic ${topic?.slug || "unknown"} needs at least one source`, `${prefix}.sources`));
    } else {
      if (!topic.sources.some((source) => source?.isPrimary === true)) {
        errors.push(error("SOURCE-004", `Topic ${topic.slug} needs a primary source`, `${prefix}.sources`));
      }
      for (const [sourceIndex, source] of topic.sources.entries()) {
        if (!nonEmpty(source?.title, 4) || !nonEmpty(source?.publisher, 2)) {
          errors.push(error("SOURCE-003", `Topic ${topic.slug} has an unnamed source`, `${prefix}.sources[${sourceIndex}]`));
        }
        try {
          const url = new URL(source?.url);
          if (url.protocol !== "https:") throw new Error("not https");
        } catch {
          errors.push(error("SOURCE-002", `Topic ${topic.slug} source URL must be valid HTTPS`, `${prefix}.sources[${sourceIndex}].url`));
        }
        if (![1, 2, 3].includes(source?.sourceTier)) {
          errors.push(error("SOURCE-005", `Topic ${topic.slug} sourceTier must be 1, 2 or 3`, `${prefix}.sources[${sourceIndex}].sourceTier`));
        }
      }
    }
  }

  if (topics[0]?.id && issue.featuredTopicId !== topics[0].id) {
    errors.push(error("TOPIC-006", "featuredTopicId must point to NO.01", "featuredTopicId"));
  }

  return errors;
}

export function validateStoryPool(storyPool, issue) {
  const errors = [];
  if (!Array.isArray(storyPool)) return [error("POOL-001", "Story Pool must be an array")];

  const duplicates = duplicateValues(storyPool.map((story) => story?.storyId));
  if (duplicates.length > 0) errors.push(error("POOL-002", "Story Pool storyId values must be present and unique"));

  const byId = new Map(storyPool.map((story) => [story?.storyId, story]));
  for (const topic of (issue?.topics || []).filter((candidate) => candidate?.rank >= 2 && candidate?.rank <= 9)) {
    const story = byId.get(topic.storyId);
    if (!story) {
      errors.push(error("POOL-003", `Story Pool is missing current story ${topic.storyId}`));
      continue;
    }
    const lastDate = story.lastIssueDate || story.lastSeenDate || story.lastSeen;
    if (lastDate !== issue.issueDate) {
      errors.push(error("POOL-004", `Story Pool entry ${topic.storyId} was not updated for ${issue.issueDate}`));
    }
    if (story.storyStatus !== topic.storyStatus || Number(story.informationIncrementScore) !== Number(topic.informationIncrementScore)) {
      errors.push(error("POOL-005", `Story Pool entry ${topic.storyId} disagrees with the current issue state`));
    }
    if ((story.lastTopicSlug || story.slug) !== topic.slug) {
      errors.push(error("POOL-006", `Story Pool entry ${topic.storyId} points to the wrong topic slug`));
    }
  }

  return errors;
}
