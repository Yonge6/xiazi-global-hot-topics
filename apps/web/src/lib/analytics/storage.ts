import { uploadToCos } from "@/lib/cos/storage";
import type { AnalyticsEvent, DailyAnalytics, TopicAnalytics } from "@/lib/analytics/types";

type StoredAnalytics = DailyAnalytics & { visitorIds: string[] };

function emptyTopic(): TopicAnalytics {
  return { posterViews: 0, shares: 0, downloads: 0, sourceClicks: 0 };
}

export function emptyDay(date: string): StoredAnalytics {
  return {
    date,
    updatedAt: new Date().toISOString(),
    uniqueVisitors: 0,
    pageViews: 0,
    zhViews: 0,
    enViews: 0,
    posterViews: 0,
    shares: 0,
    downloads: 0,
    sourceClicks: 0,
    engagedSeconds: 0,
    engagementSessions: 0,
    topics: {},
    visitorIds: [],
  };
}

function dateInBeijing(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function storageUrl(date: string) {
  const base = process.env.NEXT_PUBLIC_COS_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("统计存储尚未配置");
  return `${base}/analytics/daily/${date}.json?t=${Date.now()}`;
}

function totalStorageUrl() {
  const base = process.env.NEXT_PUBLIC_COS_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("统计存储尚未配置");
  return `${base}/analytics/total.json?t=${Date.now()}`;
}

export async function readAnalyticsDay(date: string) {
  try {
    const response = await fetch(storageUrl(date), { cache: "no-store" });
    if (!response.ok) return emptyDay(date);
    const stored = { ...emptyDay(date), ...await response.json() } as StoredAnalytics;
    stored.visitorIds = Array.isArray(stored.visitorIds) ? stored.visitorIds : [];
    stored.uniqueVisitors = stored.visitorIds.length || stored.uniqueVisitors || 0;
    return stored;
  } catch {
    return emptyDay(date);
  }
}

export async function recordAnalyticsEvent(input: {
  event: AnalyticsEvent;
  locale: "zh" | "en";
  slug?: string;
  visitorId?: string;
  durationSeconds?: number;
}) {
  const date = dateInBeijing();
  const day = await readAnalyticsDay(date);
  let total: StoredAnalytics;
  try {
    const response = await fetch(totalStorageUrl(), { cache: "no-store" });
    total = response.ok
      ? { ...emptyDay("累计"), ...await response.json() }
      : { ...structuredClone(day), date: "累计" };
  } catch {
    total = { ...structuredClone(day), date: "累计" };
  }
  total.visitorIds = Array.isArray(total.visitorIds) ? total.visitorIds : [];
  day.updatedAt = new Date().toISOString();
  total.updatedAt = day.updatedAt;

  if (input.event === "page_view") {
    day.pageViews += 1;
    total.pageViews += 1;
    if (input.visitorId && !day.visitorIds.includes(input.visitorId)) {
      day.visitorIds.push(input.visitorId);
      day.uniqueVisitors = day.visitorIds.length;
    }
    if (input.visitorId && !total.visitorIds.includes(input.visitorId)) {
      total.visitorIds.push(input.visitorId);
      total.uniqueVisitors = total.visitorIds.length;
    }
    if (input.locale === "zh") day.zhViews += 1;
    else day.enViews += 1;
    if (input.locale === "zh") total.zhViews += 1;
    else total.enViews += 1;
  }

  if (input.event === "session_duration" && input.durationSeconds) {
    day.engagedSeconds += input.durationSeconds;
    day.engagementSessions += 1;
    total.engagedSeconds += input.durationSeconds;
    total.engagementSessions += 1;
  }

  if (input.slug) {
    const topic = day.topics[input.slug] ?? emptyTopic();
    const totalTopic = total.topics[input.slug] ?? emptyTopic();
    if (input.event === "poster_view") {
      day.posterViews += 1;
      topic.posterViews += 1;
      total.posterViews += 1;
      totalTopic.posterViews += 1;
    }
    if (input.event === "share") {
      day.shares += 1;
      topic.shares += 1;
      total.shares += 1;
      totalTopic.shares += 1;
    }
    if (input.event === "download") {
      day.downloads += 1;
      topic.downloads += 1;
      total.downloads += 1;
      totalTopic.downloads += 1;
    }
    if (input.event === "source_click") {
      day.sourceClicks += 1;
      topic.sourceClicks += 1;
      total.sourceClicks += 1;
      totalTopic.sourceClicks += 1;
    }
    day.topics[input.slug] = topic;
    total.topics[input.slug] = totalTopic;
  }

  await Promise.all([
    uploadToCos(
      `analytics/daily/${date}.json`,
      Buffer.from(JSON.stringify(day)),
      "application/json",
      "no-store, max-age=0",
    ),
    uploadToCos(
      "analytics/total.json",
      Buffer.from(JSON.stringify(total)),
      "application/json",
      "no-store, max-age=0",
    ),
  ]);
  return day;
}

export async function readAnalyticsDashboard() {
  const dates = Array.from({ length: 7 }, (_, index) => dateInBeijing(-index));
  const recent = await Promise.all(dates.map(readAnalyticsDay));
  let total = { ...recent[0], date: "累计" };
  try {
    const response = await fetch(totalStorageUrl(), { cache: "no-store" });
    if (response.ok) total = { ...emptyDay("累计"), ...await response.json() };
  } catch {
    // The first event will create the cumulative file.
  }
  const sevenDayVisitorIds = new Set(recent.flatMap((day) => day.visitorIds));
  const sevenDay = {
    uniqueVisitors: sevenDayVisitorIds.size,
    pageViews: recent.reduce((sum, day) => sum + day.pageViews, 0),
  };
  const sanitize = ({ visitorIds, ...analytics }: StoredAnalytics) => {
    void visitorIds;
    return analytics;
  };
  return {
    today: sanitize(recent[0]),
    recent: recent.map(sanitize),
    total: sanitize(total),
    sevenDay,
  };
}
