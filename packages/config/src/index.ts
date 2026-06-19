export const productConfig = {
  brandNameZh: "虾子曰",
  brandNameEn: "Xiazi Says",
  sloganZh: "虾说，不瞎说",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://pluto.hk",
  publicationTimezone: process.env.PUBLICATION_TIMEZONE || "Asia/Shanghai",
  publicationHour: Number.parseInt(process.env.PUBLICATION_HOUR || "5", 10),
  publicationMinute: Number.parseInt(process.env.PUBLICATION_MINUTE || "0", 10),
  issueSize: 9,
} as const;

export function publicationTimeLabel() {
  return `${String(productConfig.publicationHour).padStart(2, "0")}:${String(productConfig.publicationMinute).padStart(2, "0")}`;
}
