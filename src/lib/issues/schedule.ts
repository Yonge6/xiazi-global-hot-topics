export const ISSUE_SLOT_HOURS_BEIJING = [0] as const;
export const ISSUE_SLOT_MINUTE_BEIJING = 5;

export const ISSUE_CRON_UTC = "5 16 * * *";

export function formatIssueTime(
  timestamp: string,
  locale: "zh" | "en",
): string {
  const date = new Date(timestamp);

  if (locale === "zh") {
    const value = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);

    return `北京时间 ${value.replaceAll("/", "-")}`;
  }

  const value = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Etc/Greenwich",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `GMT · ${value}`;
}
