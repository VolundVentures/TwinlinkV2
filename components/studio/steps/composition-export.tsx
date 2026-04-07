"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  Play,
  Share2,
  Sparkles,
  Loader2,
  CheckCircle,
  Film,
  Clock,
  Layers,
  Music,
  AlertCircle,
} from "lucide-react";
import { useStudio } from "../studio-context";
import { staggerContainer, staggerItem, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function CompositionExport() {
  const { state, dispatch } = useStudio();
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");
  const [quality, setQuality] = useState<"720p" | "1080p" | "4k">("1080p");

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async function handleRender() {
    dispatch({ type: "SET_RENDER_STATUS", status: "rendering", progress: 0 });

    try {
      const res = await fetch("/api/studio/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: state.scenes,
          frames: state.frames,
          audioLayers: state.audioLayers,
          style: state.selectedStyle,
          characters: state.characters,
          format,
          quality,
          brandId: state.brandId,
          targetPlatform: state.targetPlatform,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        dispatch({ type: "SET_RENDER_STATUS", status: "done", progress: 100, url: data.url });
      } else {
        dispatch({ type: "SET_RENDER_STATUS", status: "error" });
      }
    } catch (err) {
      console.error("Render failed:", err);
      dispatch({ type: "SET_RENDER_STATUS", status: "error" });
    }
  }

  const sceneCount = state.scenes.length;
  const hasMusic = state.audioLayers.some((l) => l.type === "music");
  const hasVoiceover = state.audioLayers.some((l) => l.type === "voiceover");
  const frameCount = state.frames.filter((f) => f.firstFrame || f.lastFrame).length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        {/* Header */}
        <motion.div variants={staggerItem} className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-[#161514]">
              <Film className="h-6 w-6 text-white" />
            </div>
          </div>
          <h2 className="text-headline-sm text-[#161514]">Final Composition</h2>
          <p className="text-[13px] text-[#737373] mt-1">
            Review your project and render the final video.
          </p>
        </motion.div>

        {/* Project summary */}
        <motion.div variants={staggerItem} className="grid grid-cols-4 gap-3 mb-8">
          {[
            { icon: Layers, label: "Scenes", value: sceneCount },
            { icon: Clock, label: "Duration", value: formatTime(state.totalDuration) },
            { icon: Film, label: "Frames", value: `${frameCount}/${sceneCount * 2}` },
            { icon: Music, label: "Audio", value: state.audioLayers.length },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white border border-[rgba(22,21,20,0.08)] rounded-xl p-4 text-center">
              <Icon className="h-5 w-5 text-[#737373] mx-auto mb-2" />
              <p className="text-[18px] font-bold mono text-[#161514]">{value}</p>
              <p className="text-[10px] text-[#a3a3a3] uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* Checklist */}
        <motion.div variants={staggerItem} className="bg-white border border-[rgba(22,21,20,0.08)] rounded-xl p-5 mb-8">
          <p className="label-caps text-[10px] mb-4">Pre-render Checklist</p>
          <div className="space-y-2">
            {[
              { check: sceneCount > 0, label: "Script with scenes defined" },
              { check: !!state.selectedStyle, label: "Visual style selected" },
              { check: frameCount > 0, label: "Key frames generated" },
              { check: hasVoiceover, label: "Voiceover recorded" },
              { check: hasMusic, label: "Background music added" },
            ].map(({ check, label }) => (
              <div key={label} className="flex items-center gap-3">
                {check ? (
                  <CheckCircle className="h-4 w-4 text-[#4D5D4B]" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-[#a3a3a3]" />
                )}
                <span className={cn("text-[13px]", check ? "text-[#161514]" : "text-[#a3a3a3]")}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Format + Quality */}
        <motion.div variants={staggerItem} className="flex gap-6 mb-8">
          <div>
            <p className="label-caps text-[10px] mb-2">Format</p>
            <div className="flex gap-2">
              {(["mp4", "webm"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-[12px] mono transition-all",
                    format === f
                      ? "border-[#161514] bg-[#161514] text-white"
                      : "border-[rgba(22,21,20,0.10)] text-[#737373] hover:border-[#161514]/30"
                  )}
                >
                  .{f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label-caps text-[10px] mb-2">Quality</p>
            <div className="flex gap-2">
              {(["720p", "1080p", "4k"] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-[12px] mono transition-all",
                    quality === q
                      ? "border-[#161514] bg-[#161514] text-white"
                      : "border-[rgba(22,21,20,0.10)] text-[#737373] hover:border-[#161514]/30"
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Render button / progress / result */}
        <motion.div variants={staggerItem} className="mb-8">
          {state.renderStatus === "idle" && (
            <motion.button
              onClick={handleRender}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={spring.snappy}
              className="flex items-center justify-center gap-3 w-full py-4 bg-[#161514] text-white rounded-xl text-[15px] font-semibold hover:bg-[#2a2928] transition-colors"
            >
              <Sparkles className="h-5 w-5" />
              Render Final Video
            </motion.button>
          )}

          {state.renderStatus === "rendering" && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#4D5D4B] mx-auto mb-4" />
              <p className="text-[14px] font-medium text-[#161514]">Rendering your masterpiece...</p>
              <p className="text-[12px] text-[#a3a3a3] mt-1">This may take a few minutes</p>
              <div className="mt-4 h-2 bg-[#F3F0EB] rounded-full overflow-hidden max-w-md mx-auto">
                <motion.div
                  className="h-full bg-[#4D5D4B] rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${state.renderProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}

          {state.renderStatus === "done" && state.compositionUrl && (
            <div className="text-center">
              <div className="bg-black rounded-xl overflow-hidden aspect-video max-w-2xl mx-auto mb-6">
                <video
                  src={state.compositionUrl}
                  controls
                  className="w-full h-full"
                />
              </div>
              <div className="flex items-center justify-center gap-3">
                <a
                  href={state.compositionUrl}
                  download
                  className="flex items-center gap-2 px-6 py-3 bg-[#161514] text-white rounded-lg text-[13px] font-medium hover:bg-[#2a2928] transition-colors"
                >
                  <Download className="h-4 w-4" /> Download
                </a>
                <button className="flex items-center gap-2 px-6 py-3 border border-[rgba(22,21,20,0.10)] rounded-lg text-[13px] text-[#737373] hover:text-[#161514] transition-colors">
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </div>
            </div>
          )}

          {state.renderStatus === "error" && (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 text-[#ba1a1a] mx-auto mb-3" />
              <p className="text-[14px] font-medium text-[#161514]">Render failed</p>
              <p className="text-[12px] text-[#a3a3a3] mt-1">Check your scenes and try again.</p>
              <button
                onClick={handleRender}
                className="mt-4 px-6 py-2 bg-[#161514] text-white rounded-lg text-[13px] font-medium"
              >
                Retry
              </button>
            </div>
          )}
        </motion.div>

        {/* Navigation */}
        <motion.div variants={staggerItem}>
          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 7 })}
            className="flex items-center gap-2 px-5 py-2.5 border border-[rgba(22,21,20,0.10)] rounded-lg text-[13px] text-[#737373] hover:text-[#161514] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Sound Design
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
