import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isAppLocale } from "@/i18n/config";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "zh" ? "隐私政策" : "Privacy Policy",
    description: locale === "zh"
      ? "虾子曰 iOS App 隐私政策"
      : "Privacy policy for the Xiazi Says iOS app",
  };
}

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const isZh = locale === "zh";

  return (
    <main className="legal-page">
      <article>
        <a className="legal-back" href={`/${locale}/`}>{isZh ? "返回虾子曰" : "Back to Xiazi Says"}</a>
        <p className="legal-kicker">XIAZI SAYS · {isZh ? "隐私" : "PRIVACY"}</p>
        <h1>{isZh ? "隐私政策" : "Privacy Policy"}</h1>
        <p className="legal-updated">{isZh ? "生效日期：2026 年 8 月 9 日" : "Effective: August 9, 2026"}</p>

        {isZh ? (
          <>
            <h2>我们不收集什么</h2>
            <p>虾子曰 iOS App 不要求注册，不收集姓名、邮箱、电话、精确位置、通讯录、照片、支付信息或广告标识符，不投放第三方广告，也不进行跨 App 或跨网站追踪。</p>
            <h2>App 如何工作</h2>
            <p>App 从 xiazishuo.com 读取已公开发布的中英文刊物和海报。主题偏好及上次阅读位置只保存在设备本地；iOS App 会关闭网站版的匿名访问统计，这些本地信息不会由 App 发送给我们。</p>
            <h2>外部链接与分享</h2>
            <p>当你打开新闻来源、社交媒体或其他第三方链接时，将适用对方的隐私政策。海报分享使用 Apple 系统分享面板，分享对象和所选服务由你决定。</p>
            <h2>联系我们</h2>
            <p>如对隐私有疑问，请发送邮件至 <a href="mailto:hustyy986@gmail.com">hustyy986@gmail.com</a>。</p>
          </>
        ) : (
          <>
            <h2>What we do not collect</h2>
            <p>Xiazi Says for iOS requires no account. We do not collect your name, email address, phone number, precise location, contacts, photos, payment information, or advertising identifier. We do not show third-party ads or track you across apps or websites.</p>
            <h2>How the app works</h2>
            <p>The app retrieves publicly published bilingual editions and posters from xiazishuo.com. Theme preferences and your last reading location stay on your device. Anonymous website analytics are disabled on the iOS app surface, and the app does not send these local preferences to us.</p>
            <h2>External links and sharing</h2>
            <p>News sources, social media, and other third-party links are governed by their own privacy policies. Poster sharing uses Apple&rsquo;s system share sheet, and you choose the recipient and service.</p>
            <h2>Contact</h2>
            <p>For privacy questions, email <a href="mailto:hustyy986@gmail.com">hustyy986@gmail.com</a>.</p>
          </>
        )}
      </article>
    </main>
  );
}
