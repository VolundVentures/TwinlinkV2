"use client";

import { createContext, useContext } from "react";
import {
  translations,
  RTL_LOCALES,
  type Locale,
  type TranslationKeys,
} from "./translations";

type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isRTL: boolean;
  t: TranslationKeys;
  dir: "ltr" | "rtl";
};

export const LanguageContext = createContext<LanguageContextType>({
  locale: "en",
  setLocale: () => {},
  isRTL: false,
  t: translations.en,
  dir: "ltr",
});

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}

export function getTranslations(locale: Locale) {
  return {
    t: translations[locale],
    isRTL: RTL_LOCALES.includes(locale),
    dir: (RTL_LOCALES.includes(locale) ? "rtl" : "ltr") as "rtl" | "ltr",
  };
}
