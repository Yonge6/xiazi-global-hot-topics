import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { AboutSection } from "@/components/about-section";
import { IssueMasthead } from "@/components/issue-masthead";
import { SiteHeader } from "@/components/site-header";
import { TopicGallery } from "@/components/topic-gallery";
import { productConfig, publicationTimeLabel } from "@xiazi/config";
import { mockIssue } from "@/data/mock-issue";
import { isAppLocale } from "@/i18n/config";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

export function generateStaticParams() {
  return [{ locale: "zh" }, { locale: "en" }];
}

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const isZh = locale === "zh";
  const timeLabel = publicationTimeLabel();
  const title = isZh ? "昨日世界 | 虾子曰全球热点海报" : "The World Yesterday | Xiazi Global Hot Topics";
  const description = isZh
    ? `每天 ${timeLabel}，用 9 条双语内容，看懂正在变化的世界。`
    : `Nine bilingual stories at ${timeLabel} Beijing Time, capturing a changing world.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}`,
      languages: { "zh-CN": "/zh", "en-US": "/en" },
    },
    openGraph: {
      title,
      description,
      url: `${productConfig.siteUrl}/${locale}`,
      siteName: productConfig.brandNameEn,
      locale: isZh ? "zh_CN" : "en_US",
      type: "website",
    },
  };
}

export default async function LocaleHome({ params }: PageProps) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);

  const messages = (locale === "zh" ? zh : en) as Record<string, string>;
  const timeLabel = publicationTimeLabel();
  return (
    <main>
      <SiteHeader locale={locale} messages={messages} />
      <IssueMasthead locale={locale} issueDate={mockIssue.issueDate} />
      <TopicGallery
        topics={mockIssue.topics}
        locale={locale}
        issueDate={mockIssue.issueDate}
        initialAssetVersion={mockIssue.beijingTimestamp || mockIssue.issueDate}
      />

      <AboutSection locale={locale} />

      <footer className="catalogue-footer">
        <div className="shell">
          <p>{messages["footer.slogan"]}</p>
          <div>
            <span>ISSN {mockIssue.issueDate.replaceAll("-", "—")}</span>
            <span>BEIJING · {timeLabel} DAILY</span>
            <strong>{new URL(productConfig.siteUrl).hostname}</strong>
          </div>
        </div>
      </footer>
    </main>
  );
}
