import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { AboutSection } from "@/components/about-section";
import { IssueMasthead } from "@/components/issue-masthead";
import { SiteHeader } from "@/components/site-header";
import { TopicGallery } from "@/components/topic-gallery";
import { productConfig, publicationTimeLabel } from "@xiazi/config";
import { sortTopicsForIssue } from "@xiazi/domain";
import { mockIssue } from "@/data/mock-issue";
import { isAppLocale } from "@/i18n/config";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";
import { getContentRepository } from "@/server/repositories/get-content-repository";

export const revalidate = 60;

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
  const repository = getContentRepository();
  const [issueResult, archiveResult] = await Promise.allSettled([
    repository.getLatestPublishedIssue(),
    repository.listPublishedIssues(),
  ]);
  const issue = issueResult.status === "fulfilled"
    ? { ...issueResult.value, topics: sortTopicsForIssue(issueResult.value.topics) }
    : mockIssue;
  const archiveDates = archiveResult.status === "fulfilled"
    ? archiveResult.value.map((item) => item.issueDate)
    : [];

  return (
    <main>
      <SiteHeader locale={locale} messages={messages} />
      <IssueMasthead locale={locale} issueDate={issue.issueDate} />
      <TopicGallery
        topics={issue.topics}
        locale={locale}
        issueDate={issue.issueDate}
        initialAssetVersion={issue.assetVersion || issue.beijingTimestamp || issue.issueDate}
        initialArchiveDates={archiveDates}
      />

      <AboutSection locale={locale} />

      <footer className="catalogue-footer">
        <div className="shell">
          <p>{messages["footer.slogan"]}</p>
          <div>
            <span>ISSN {issue.issueDate.replaceAll("-", "—")}</span>
            <span>BEIJING · {timeLabel} DAILY</span>
            <strong>{new URL(productConfig.siteUrl).hostname}</strong>
          </div>
        </div>
      </footer>
    </main>
  );
}
