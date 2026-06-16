export const analyticsEvents = [
  "page_view",
  "poster_view",
  "share",
  "download",
  "source_click",
  "session_duration",
] as const;

export type AnalyticsEvent = typeof analyticsEvents[number];

export interface TopicAnalytics {
  posterViews: number;
  shares: number;
  downloads: number;
  sourceClicks: number;
}

export interface DailyAnalytics {
  date: string;
  updatedAt: string;
  uniqueVisitors: number;
  pageViews: number;
  zhViews: number;
  enViews: number;
  posterViews: number;
  shares: number;
  downloads: number;
  sourceClicks: number;
  engagedSeconds: number;
  engagementSessions: number;
  topics: Record<string, TopicAnalytics>;
}

export interface AnalyticsDashboard {
  today: DailyAnalytics;
  recent: DailyAnalytics[];
  total: DailyAnalytics;
  sevenDay: {
    uniqueVisitors: number;
    pageViews: number;
  };
}
