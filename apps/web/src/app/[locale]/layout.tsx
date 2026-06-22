import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { isAppLocale } from "@/i18n/config";
import { nestMessages } from "@/i18n/messages";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

export function generateStaticParams() {
  return [{ locale: "zh" }, { locale: "en" }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = (locale === "zh" ? zh : en) as Record<string, string>;
  return (
    <NextIntlClientProvider locale={locale} messages={nestMessages(messages)}>
      <div className={`locale-page locale-${locale}`}>{children}</div>
    </NextIntlClientProvider>
  );
}
