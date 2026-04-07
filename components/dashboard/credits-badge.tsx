"use client";

import { useTranslation } from "@/lib/i18n/use-translations";

export function CreditsBadge({ credits }: { credits: number }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-2.5 py-1.5 text-[13px]">
      <span className="font-semibold text-black tabular-nums">{credits}</span>
      <span className="text-[#a3a3a3]">{t.credits.creditsLeft}</span>
    </div>
  );
}
