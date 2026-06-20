"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Locale, TranslationKey, t as translate } from "@/lib/i18n";

type I18nContextType = {
  locale: Locale;
  t: (key: TranslationKey) => string;
  toggleLocale: () => void;
  isRTL: boolean;
};

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  t: (key) => key,
  toggleLocale: () => {},
  isRTL: false,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("faerp-locale") as Locale | null;
    if (saved === "ar" || saved === "en") {
      setLocale(saved);
      applyLocale(saved);
    }
  }, []);

  const applyLocale = (l: Locale) => {
    const dir = l === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", l);
    // Set cookie for server components to read
    document.cookie = `faerp-locale=${l}; path=/; max-age=31536000`;
    // Readex Pro Variable supports both Arabic and Latin scripts natively —
    // keep the same font for both locales (Cairo/Tajawal/Inter are not preloaded)
    document.documentElement.style.setProperty(
      "--font-sans",
      "'Readex Pro Variable', -apple-system, BlinkMacSystemFont, sans-serif"
    );
  };

  const toggleLocale = useCallback(() => {
    const next: Locale = locale === "en" ? "ar" : "en";
    setLocale(next);
    localStorage.setItem("faerp-locale", next);
    applyLocale(next);
  }, [locale]);

  const tFn = useCallback(
    (key: TranslationKey) => translate(key, locale),
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, t: tFn, toggleLocale, isRTL: locale === "ar" }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
