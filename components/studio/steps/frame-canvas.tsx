"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, ImageIcon, RefreshCw, Sparkles, Link2 } from "lucide-react";
import { useStudio } from "../studio-context";
import { staggerContainer, staggerItem, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function FrameCanvas() {
  const { state, dispatch } = useStudio();
  const [generatingScene, setGeneratingScene] = useState<number | null>(null);

  async function generateFrames(sceneIndex: number) {
    setGeneratingScene(sceneIndex);
    const scene = state.scenes[sceneIndex];
    if (!scene) return;

    try {
      const res = await fetch("/api/studio/generate-frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene,
          sceneIndex,
          style: state.selectedStyle,
          brandId: state.brandId,
          // Pass previous scene's last frame for continuity
          previousLastFrame: sceneIndex > 0
            ? state.frames.find((f) => f.sceneIndex === sceneIndex - 1)?.lastFrame?.url
            : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.firstFrame) {
          dispatch({ type: "SET_FRAME", sceneIndex, position: "first", url: data.firstFrame.url, prompt: data.firstFrame.prompt });
        }
        if (data.lastFrame) {
          dispatch({ type: "SET_FRAME", sceneIndex, position: "last", url: data.lastFrame.url, prompt: data.lastFrame.prompt });
        }
      }
    } catch (err) {
      console.error("Failed to generate frames:", err);
    }

    setGeneratingScene(null);
  }

  function getFramePair(sceneIndex: number) {
    return state.frames.find((f) => f.sceneIndex === sceneIndex) || {
      sceneIndex,
      firstFrame: null,
      lastFrame: null,
    };
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        {/* Header */}
        <motion.div variants={staggerItem} className="mb-8">
          <h2 className="text-headline-sm text-[#161514]">Frame Design</h2>
          <p className="text-[13px] text-[#737373] mt-1">
            Generate first and last frames for each scene. The last frame connects visually to the next scene&apos;s first frame.
          </p>
        </motion.div>

        {/* Continuity strip */}
        <motion.div variants={staggerItem} className="mb-8">
          <p className="label-caps text-[10px] mb-3">Continuity Strip</p>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {state.scenes.map((scene, i) => {
              const pair = getFramePair(i);
              return (
                <div key={scene.id} className="flex gap-0.5 shrink-0">
                  {/* First frame */}
                  <div className={cn(
                    "w-20 h-12 rounded flex items-center justify-center text-[9px] mono",
                    pair.firstFrame ? "bg-[#161514]" : "bg-[#F3F0EB] text-[#a3a3a3]"
                  )}>
                    {pair.firstFrame ? (
                      <img src={pair.firstFrame.url} alt="" className="w-full h-full object-cover rounded" />
                    ) : (
                      `S${i + 1}:A`
                    )}
                  </div>
                  {/* Last frame */}
                  <div className={cn(
                    "w-20 h-12 rounded flex items-center justify-center text-[9px] mono",
                    pair.lastFrame ? "bg-[#161514]" : "bg-[#F3F0EB] text-[#a3a3a3]"
                  )}>
                    {pair.lastFrame ? (
                      <img src={pair.lastFrame.url} alt="" className="w-full h-full object-cover rounded" />
                    ) : (
                      `S${i + 1}:B`
                    )}
                  </div>
                  {/* Continuity link indicator */}
                  {i < state.scenes.length - 1 && (
                    <div className="flex items-center px-1">
                      <Link2 className="h-3 w-3 text-[#4D5D4B]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Scene frame pairs */}
        <motion.div variants={staggerItem} className="space-y-4 mb-10">
          {state.scenes.map((scene, i) => {
            const pair = getFramePair(i);
            const isGenerating = generatingScene === i;

            return (
              <div
                key={scene.id}
                className="bg-white border border-[rgba(22,21,20,0.08)] rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#161514] text-white text-[11px] font-semibold">
                      {i + 1}
                    </span>
                    <span className="text-[14px] font-medium text-[#161514]">{scene.title}</span>
                    <span className="mono text-[11px] text-[#a3a3a3]">{scene.durationSeconds}s</span>
                  </div>
                  <motion.button
                    onClick={() => generateFrames(i)}
                    disabled={isGenerating}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={spring.snappy}
                    className="flex items-center gap-2 px-4 py-2 bg-[#161514] text-white rounded-lg text-[12px] font-medium disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                    ) : pair.firstFrame ? (
                      <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
                    ) : (
                      <><Sparkles className="h-3.5 w-3.5" /> Generate Frames</>
                    )}
                  </motion.button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* First frame */}
                  <div>
                    <p className="label-caps text-[10px] mb-2">First Frame</p>
                    <div className={cn(
                      "aspect-video rounded-lg flex items-center justify-center overflow-hidden",
                      pair.firstFrame ? "bg-black" : "bg-[#F3F0EB] border border-dashed border-[rgba(22,21,20,0.12)]"
                    )}>
                      {pair.firstFrame ? (
                        <img src={pair.firstFrame.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="h-6 w-6 text-[#a3a3a3] mx-auto mb-1" />
                          <p className="text-[11px] text-[#a3a3a3]">Click generate</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Last frame */}
                  <div>
                    <p className="label-caps text-[10px] mb-2">Last Frame</p>
                    <div className={cn(
                      "aspect-video rounded-lg flex items-center justify-center overflow-hidden",
                      pair.lastFrame ? "bg-black" : "bg-[#F3F0EB] border border-dashed border-[rgba(22,21,20,0.12)]"
                    )}>
                      {pair.lastFrame ? (
                        <img src={pair.lastFrame.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="h-6 w-6 text-[#a3a3a3] mx-auto mb-1" />
                          <p className="text-[11px] text-[#a3a3a3]">Click generate</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Visual direction reminder */}
                {scene.visualDirection && (
                  <p className="mt-3 text-[11px] text-[#a3a3a3] italic">&ldquo;{scene.visualDirection}&rdquo;</p>
                )}
              </div>
            );
          })}
        </motion.div>

        {/* Navigation */}
        <motion.div variants={staggerItem} className="flex items-center justify-between">
          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 4 })}
            className="flex items-center gap-2 px-5 py-2.5 border border-[rgba(22,21,20,0.10)] rounded-lg text-[13px] text-[#737373] hover:text-[#161514] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Characters
          </button>
          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 6 })}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#161514] text-white rounded-lg text-[13px] font-medium hover:bg-[#2a2928] transition-colors"
          >
            Refine Scenes <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
