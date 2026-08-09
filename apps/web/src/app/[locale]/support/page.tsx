import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isAppLocale } from "@/i18n/config";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "zh" ? "App 支持" : "App Support",
    description: locale === "zh" ? "获取虾子曰 iOS App 支持" : "Get support for Xiazi Says on iOS",
  };
}

export default async function SupportPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const isZh = locale === "zh";

  return (
    <main className="legal-page">
      <article>
        <a className="legal-back" href={`/${locale}/`}>{isZh ? "返回虾子曰" : "Back to Xiazi Says"}</a>
        <p className="legal-kicker">XIAZI SAYS · {isZh ? "支持" : "SUPPORT"}</p>
        <h1>{isZh ? "App 支持" : "App Support"}</h1>
        <p>{isZh
          ? "虾子曰每天更新一张总览、八件全球热点和十八张双语海报。App 内容来自同一在线刊物，下拉即可刷新。"
          : "Xiazi Says publishes one daily overview, eight global stories, and eighteen bilingual posters. The app reads the same online edition and supports pull-to-refresh."}</p>
        <h2>{isZh ? "常见处理" : "Quick help"}</h2>
        <ul>
          <li>{isZh ? "内容未更新：下拉页面刷新，或退出后重新打开 App。" : "Edition not updated: pull down to refresh, or reopen the app."}</li>
          <li>{isZh ? "无法加载：检查网络连接后点击“重新载入”。" : "Unable to load: check your connection and tap Reload."}</li>
          <li>{isZh ? "分享海报：打开海报并选择系统分享按钮。" : "Share a poster: open it and choose the system share action."}</li>
        </ul>
        <h2>{isZh ? "联系我们" : "Contact us"}</h2>
        <p><a href="mailto:hustyy986@gmail.com">hustyy986@gmail.com</a></p>
        <p><a href={`/${locale}/privacy/`}>{isZh ? "查看隐私政策" : "View the privacy policy"}</a></p>
      </article>
    </main>
  );
}
