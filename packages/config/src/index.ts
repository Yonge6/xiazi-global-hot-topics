export const productConfig = {
  brandNameZh: "虾子曰",
  brandNameEn: "Xiazi Says",
  sloganZh: "虾说，不瞎说",
  // Public metadata and share links are intentionally pinned to the Xiazi
  // origin. Deployment configuration must never be able to move them onto a
  // retired or unrelated project domain.
  siteUrl: "https://xiazishuo.com" as string,
  publicationTimezone: process.env.PUBLICATION_TIMEZONE || "Asia/Shanghai",
  publicationHour: Number.parseInt(process.env.PUBLICATION_HOUR || "5", 10),
  publicationMinute: Number.parseInt(process.env.PUBLICATION_MINUTE || "0", 10),
  issueSize: 9,
} as const;

export function publicationTimeLabel() {
  return `${String(productConfig.publicationHour).padStart(2, "0")}:${String(productConfig.publicationMinute).padStart(2, "0")}`;
}
