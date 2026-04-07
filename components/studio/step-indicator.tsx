"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { STUDIO_STEPS, type StudioStep } from "./studio-types";
import { useStudio } from "./studio-context";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function StepIndicator() {
  const { state, dispatch } = useStudio();
  const current = state.currentStep;

  return (
    <div className="flex items-center gap-1 px-3 sm:px-6 py-3 sm:py-4 overflow-x-auto scrollbar-hide">
      {STUDIO_STEPS.map(({ step, label }, i) => {
        const isActive = step === current;
        const isCompleted = step < current;
        const isClickable = step <= current;

        return (
          <div key={step} className="flex items-center">
            <button
              onClick={() => isClickable && dispatch({ type: "SET_STEP", step })}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2 rounded-full text-[12px] tracking-wide transition-all",
                isActive && "bg-[#161514] text-white font-medium",
                isCompleted && "bg-[#F3F0EB] text-[#161514] font-medium cursor-pointer hover:bg-[#ebe6df]",
                !isActive && !isCompleted && "text-[#a3a3a3] cursor-default"
              )}
            >
              {isCompleted ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={spring.snappy}
                >
                  <Check className="h-3.5 w-3.5 text-[#4D5D4B]" />
                </motion.div>
              ) : (
                <span className={cn(
                  "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold border",
                  isActive ? "border-white/30 text-white" : "border-[#d4d4d4] text-[#a3a3a3]"
                )}>
                  {step}
                </span>
              )}
              <span className="hidden sm:inline">{label}</span>
            </button>

            {i < STUDIO_STEPS.length - 1 && (
              <div className={cn(
                "w-8 h-px mx-1",
                step < current ? "bg-[#4D5D4B]" : "bg-[#e5e5e5]"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
