import Link from "next/link";
import Image from "next/image";

import { LanguageSwitcher } from "@/components/language-switcher";
import { MobileMenu } from "@/components/mobile-menu";
import type { AppLocale } from "@/i18n/config";
import { getBrandAsset } from "@/lib/posters/assets";

export function SiteHeader({ locale, messages }: { locale: AppLocale; messages: Record<string, string> }) {
  return (
    <header className="site-header">
      <div className="shell site-header-inner">
        <Link href={`/${locale}`} className="brand-lockup">
          <Image src={getBrandAsset("brand/logo/xiazi-global-hot-topics.webp")} alt={messages.brand} width={92} height={92} className="brand-logo" priority />
        </Link>
        <div className="header-right">
          <LanguageSwitcher locale={locale} />
          <MobileMenu locale={locale} />
        </div>
      </div>
    </header>
  );
}
