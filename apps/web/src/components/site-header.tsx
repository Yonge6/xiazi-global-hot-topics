import Link from "next/link";
import Image from "next/image";

import { LanguageSwitcher } from "@/components/language-switcher";
import { MobileMenu } from "@/components/mobile-menu";
import type { AppLocale } from "@/i18n/config";
import { getCosAsset } from "@/lib/posters/assets";

export function SiteHeader({ locale, messages }: { locale: AppLocale; messages: Record<string, string> }) {
  const isZh = locale === "zh";
  const mobileNavItems = [
    { href: "#stories", label: isZh ? "昨日世界" : "Yesterday" },
    { href: "https://pluto.hk/english-quote-log/", label: isZh ? "英语句子" : "English Lines" },
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
          <Image src={getCosAsset("brand/logo/xiazi-global-hot-topics.webp")} alt={messages.brand} width={92} height={92} className="brand-logo" priority />
        </Link>
        <div className="header-right">
          <nav aria-label="Primary navigation">
            {desktopNavItems.map((item) => (
              <a href={item.href} key={item.href}>{item.label}</a>
            ))}
          </nav>
          <LanguageSwitcher locale={locale} />
          <MobileMenu label={isZh ? "菜单" : "Menu"} items={mobileNavItems} />
        </div>
      </div>
    </header>
  );
}
