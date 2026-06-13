import { cookies } from "next/headers";
import { Locale, TranslationKey, t as translate } from "@/lib/i18n";

export function getServerLocale(): Locale {
  try {
    const cookieStore = cookies();
    const val = cookieStore.get("faerp-locale")?.value;
    if (val === "ar" || val === "en") return val;
  } catch {}
  return "en";
}

export function getServerT(): (key: TranslationKey) => string {
  const locale = getServerLocale();
  return (key: TranslationKey) => translate(key, locale);
}
