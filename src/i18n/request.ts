import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isAppLocale } from "@/i18n/config";
import { nestMessages } from "@/i18n/messages";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isAppLocale(requested) ? requested : defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default as Record<string, string>;

  return {
    locale,
    messages: nestMessages(messages),
  };
});
