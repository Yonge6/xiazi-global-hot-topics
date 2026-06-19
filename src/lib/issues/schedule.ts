import { productConfig } from "@/config/product";

export const ISSUE_SLOT_HOURS_BEIJING = [productConfig.publicationHour] as const;
export const ISSUE_SLOT_MINUTE_BEIJING = productConfig.publicationMinute;
export const ISSUE_CRON_UTC = "0 21 * * *";

export function formatIssueTime(
  timestamp: string,
  locale: "zh" | "en",
): string {
  const issueDate = timestamp.slice(0, 10);
  const date = new Date(
    `${issueDate}T${String(productConfig.publicationHour).padStart(2, "0")}:${String(productConfig.publicationMinute).padStart(2, "0")}:00+08:00`,
  );

  if (locale === "zh") {
    const value = new Intl.DateTimeFormat("zh-CN", {
      timeZone: productConfig.publicationTimezone,
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
