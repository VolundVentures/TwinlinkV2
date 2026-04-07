"use client";

import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Palette } from "lucide-react";
import { useStudio } from "../studio-context";
import { STYLE_PRESETS } from "../studio-types";
import { staggerContainer, staggerItem, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function StylePicker() {
  const { state, dispatch } = useStudio();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        {/* Header */}
        <motion.div variants={staggerItem} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Palette className="h-5 w-5 text-[#4D5D4B]" />
            <h2 className="text-headline-sm text-[#161514]">Artistic Direction</h2>
          </div>
          <p className="text-[13px] text-[#737373]">
            Choose a visual style that matches your brand. This guides image generation, color grading, and composition.
          </p>
        </motion.div>

        {/* Style grid */}
        <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {STYLE_PRESETS.map((preset) => {
            const isSelected = state.selectedStyle === preset.id;
            return (
              <motion.button
                key={preset.id}
                onClick={() => dispatch({ type: "SET_STYLE", styleId: preset.id })}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={spring.snappy}
                className={cn(
                  "relative flex flex-col items-start text-left rounded-xl border overflow-hidden transition-all",
                  isSelected
                    ? "border-[#161514] ring-1 ring-[#161514]"
                    : "border-[rgba(22,21,20,0.08)] hover:border-[rgba(22,21,20,0.20)]"
                )}
              >
                {/* Image background with gradient */}
                <div className="relative h-32 overflow-hidden">
                  {preset.imageUrl ? (
                    <img src={preset.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex w-full h-full">
                      {preset.colorPalette.map((color, i) => (
                        <div key={i} style={{ backgroundColor: color }} className="flex-1" />
                      ))}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  {/* Name on image */}
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="text-white text-[14px] font-semibold">{preset.name}</span>
                  </div>
                  {/* Selected indicator */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={spring.snappy}
                      className="absolute top-2.5 right-2.5 flex items-center justify-center h-6 w-6 rounded-full bg-white shadow-lg"
                    >
                      <Check className="h-3.5 w-3.5 text-[#161514]" />
                    </motion.div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 w-full">
                  <p className="text-[11px] text-[#737373] leading-relaxed line-clamp-2">
                    {preset.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {preset.bestFor.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-[#F3F0EB] text-[9px] text-[#737373] rounded-full uppercase tracking-wider"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Selected style detail */}
        {state.selectedStyle && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.smooth}
            className="mb-10 p-5 bg-white border border-[rgba(22,21,20,0.08)] rounded-lg"
          >
            {(() => {
              const preset = STYLE_PRESETS.find((p) => p.id === state.selectedStyle);
              if (!preset) return null;
              return (
                <div>
                  <p className="label-caps text-[10px] mb-2">Prompt Anchors (used for image generation)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preset.promptAnchors.map((anchor) => (
                      <span
                        key={anchor}
                        className="px-3 py-1.5 bg-[#161514] text-white text-[11px] rounded-full"
                      >
                        {anchor}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* Navigation */}
        <motion.div variants={staggerItem} className="flex items-center justify-between">
          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 2 })}
            className="flex items-center gap-2 px-5 py-2.5 border border-[rgba(22,21,20,0.10)] rounded-lg text-[13px] text-[#737373] hover:text-[#161514] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Script
          </button>
          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 4 })}
            disabled={!state.selectedStyle}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg text-[13px] font-medium transition-all",
              state.selectedStyle
                ? "bg-[#161514] text-white hover:bg-[#2a2928]"
                : "bg-[#F3F0EB] text-[#a3a3a3] cursor-not-allowed"
            )}
          >
            Characters <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
