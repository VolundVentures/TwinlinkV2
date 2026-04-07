"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import { LanguageContext } from "@/lib/i18n/use-translations";
import {
  translations,
  RTL_LOCALES,
  type Locale,
} from "@/lib/i18n/translations";

const COOKIE_NAME = "twinlink-locale";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  const value = cookie?.split("=")[1] as Locale | undefined;
  return value && (value === "en" || value === "ar") ? value : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    document.cookie = `${COOKIE_NAME}=${newLocale};path=/;max-age=31536000`;
    document.documentElement.lang = newLocale;
    document.documentElement.dir = RTL_LOCALES.includes(newLocale)
      ? "rtl"
      : "ltr";
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.includes(locale)
      ? "rtl"
      : "ltr";
  }, [locale]);

  const isRTL = RTL_LOCALES.includes(locale);

  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
        isRTL,
        t: translations[locale],
        dir: isRTL ? "rtl" : "ltr",
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
