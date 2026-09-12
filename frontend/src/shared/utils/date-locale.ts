import type { Locale } from "date-fns";
import { enUS, es } from "date-fns/locale";

const DATE_LOCALES: Record<string, Locale> = { en: enUS, es };

export function getDateLocale(language: string | undefined): Locale {
  const base = language?.split("-")[0] ?? "en";
  return DATE_LOCALES[base] ?? enUS;
}
