"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AppLocale } from "@/i18n/config";

export function LanguageSwitcher({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const targetLocale = locale === "zh" ? "en" : "zh";
  const targetPath = /^\/(zh|en)(?=\/|$)/.test(pathname)
    ? pathname.replace(/^\/(zh|en)(?=\/|$)/, `/${targetLocale}`)
    : `/${targetLocale}`;

  return (
    <Link
      href={targetPath}
      className="language-switcher"
      aria-label={locale === "zh" ? "Switch to English" : "切换至中文"}
    >
      <span className={locale === "zh" ? "active" : ""}>中</span>
      <span aria-hidden="true">/</span>
      <span className={locale === "en" ? "active" : ""}>EN</span>
    </Link>
  );
}
