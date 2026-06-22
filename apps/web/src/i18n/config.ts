export const locales = ["zh", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "zh";

export function isAppLocale(value: string): value is AppLocale {
  return locales.includes(value as AppLocale);
}
