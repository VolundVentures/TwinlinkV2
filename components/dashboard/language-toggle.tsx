"use client";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translations";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { locale, setLocale } = useTranslation();

  function toggle() {
    setLocale(locale === "en" ? "ar" : "en");
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="gap-1.5 text-xs text-black/50 hover:text-black hover:bg-black/5"
    >
      <Languages className="h-4 w-4" />
      {locale === "en" ? "عربي" : "EN"}
    </Button>
  );
}
