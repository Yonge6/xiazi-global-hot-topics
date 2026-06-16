import Link from "next/link";
import Image from "next/image";

import { LanguageSwitcher } from "@/components/language-switcher";
import type { AppLocale } from "@/i18n/config";
import { getCosAsset } from "@/lib/posters/assets";

export function SiteHeader({ locale, messages }: { locale: AppLocale; messages: Record<string, string> }) {
  return (
    <header className="site-header">
      <div className="shell site-header-inner">
        <Link href={`/${locale}`} className="brand-lockup">
          <Image src={getCosAsset("brand/logo/xiazi-global-hot-topics.webp")} alt={messages.brand} width={92} height={92} className="brand-logo" priority />
        </Link>
        <div className="header-right">
          <nav aria-label="Primary navigation">
            <a href="#stories">{locale === "zh" ? "昨日世界" : "Yesterday"}</a>
            <a href="#archive">{locale === "zh" ? "归档" : "Archive"}</a>
            <a href="#about">{locale === "zh" ? "关于" : "About"}</a>
          </nav>
          <LanguageSwitcher locale={locale} />
        </div>
      </div>
    </header>
  );
}
