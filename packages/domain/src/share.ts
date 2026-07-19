import { productConfig } from "@xiazi/config";
import type { AppLanguage, Topic } from "@xiazi/contracts";

export type ShareDetails = {
  title: string;
  intro: string;
  url: string;
  text: string;
};

export function topicShareDetails(topic: Topic, locale: AppLanguage, siteUrl = productConfig.siteUrl): ShareDetails {
  const content = topic.localizations[locale === "zh" ? "zh-CN" : "en-US"];
  let canonicalSiteUrl = "https://xiazishuo.com";
  try {
    const configured = new URL(siteUrl);
    if (configured.hostname === "xiazishuo.com" || configured.hostname.endsWith(".xiazishuo.com")) {
      canonicalSiteUrl = configured.origin;
    }
  } catch {
    // Shared links remain on the canonical Xiazi domain when configuration is malformed.
  }
  const url = `${canonicalSiteUrl}/${locale}/#${topic.slug}`;
  return {
    title: content.headlineFull,
    intro: content.intro,
    url,
    text: `${content.headlineFull}\n\n${content.intro}\n\n${url}`,
  };
}
