"use client";

import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translations";

type Props = {
  currentStep: number;
  totalSteps: number;
  description: string;
};

export function AgentSteps({ currentStep, totalSteps, description }: Props) {
  const { t } = useTranslation();
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="border-b border-[#F0F0F0] bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#4D5D4B]" />
          <span className="text-[14px] font-medium text-[#1A1A1A]">{description}</span>
        </div>
        <span className="text-[13px] text-[#9CA3AF]">
          {t.agent.step} {currentStep} {t.agent.of} {totalSteps}
        </span>
      </div>
      {/* Clean horizontal progress bar with green fill */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
        <div
          className="h-full rounded-full bg-[#4D5D4B] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
