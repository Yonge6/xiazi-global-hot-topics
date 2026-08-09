import Link from "next/link";
import Image from "next/image";

import { LanguageSwitcher } from "@/components/language-switcher";
import { MobileMenu } from "@/components/mobile-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AppLocale } from "@/i18n/config";
import { getBrandAsset } from "@/lib/posters/assets";

export function SiteHeader({ locale, messages, issueDate }: { locale: AppLocale; messages: Record<string, string>; issueDate: string }) {
  const isZh = locale === "zh";
  const mobileNavItems = [
    { href: "#stories", label: isZh ? "昨日世界" : "Yesterday" },
    { href: "https://xiazishuo.com/english-quote-log/", label: isZh ? "英语句子" : "English Lines" },
    { href: "#archive", label: isZh ? "往期归档" : "Archive" },
    { href: "#about", label: isZh ? "关于我们" : "About" },
  ];
  const desktopNavItems = [
    mobileNavItems[0],
    mobileNavItems[2],
    mobileNavItems[1],
    mobileNavItems[3],
  ];

  return (
    <header className="site-header">
      <div className="shell site-header-inner">
        <Link href={`/${locale}`} className="brand-lockup">
          <Image src={getBrandAsset("brand/logo/xiazi-global-hot-topics.webp")} alt={messages.brand} width={92} height={92} className="brand-logo" priority />
        </Link>
        <div className="header-right">
          <nav aria-label="Primary navigation">
            {desktopNavItems.map((item) => (
              <a href={item.href} key={item.href}>{item.label}</a>
            ))}
          </nav>
          <ThemeToggle locale={locale} />
          <LanguageSwitcher locale={locale} />
          <MobileMenu locale={locale} issueDate={issueDate} />
        </div>
      </div>
    </header>
  );
}
