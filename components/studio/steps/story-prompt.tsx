"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Film, Sparkles, Clock, Monitor, Smartphone, Square } from "lucide-react";
import { useStudio } from "../studio-context";
import { fadeInUp, staggerContainer, staggerItem, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

const TONES = [
  { id: "cinematic", label: "Cinematic", description: "Epic, premium, film-quality", image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=250&fit=crop", gradient: "from-indigo-900/80 to-black/60" },
  { id: "documentary", label: "Documentary", description: "Authentic, observational", image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=250&fit=crop", gradient: "from-stone-800/80 to-black/50" },
  { id: "energetic", label: "Energetic", description: "Fast-paced, high energy", image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=250&fit=crop", gradient: "from-orange-900/70 to-black/50" },
  { id: "editorial", label: "Editorial", description: "Clean, sophisticated", image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=250&fit=crop", gradient: "from-neutral-800/70 to-black/40" },
  { id: "playful", label: "Playful", description: "Fun, colorful, casual", image: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&h=250&fit=crop", gradient: "from-pink-900/60 to-black/40" },
  { id: "dramatic", label: "Dramatic", description: "Tension, contrast, emotion", image: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400&h=250&fit=crop", gradient: "from-red-950/80 to-black/60" },
];

const PLATFORMS = [
  { id: "tiktok", label: "TikTok", icon: Smartphone, ratio: "9:16" },
  { id: "instagram_reels", label: "Reels", icon: Smartphone, ratio: "9:16" },
  { id: "youtube", label: "YouTube", icon: Monitor, ratio: "16:9" },
  { id: "instagram_feed", label: "Feed", icon: Square, ratio: "1:1" },
];

const DURATIONS = [15, 30, 60, 90, 120];

export function StoryPrompt() {
  const { state, dispatch } = useStudio();
  const [prompt, setPrompt] = useState(state.storyPrompt);
  const [tone, setTone] = useState(state.tone);
  const [platform, setPlatform] = useState(state.targetPlatform);
  const [duration, setDuration] = useState(state.targetDuration);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleContinue() {
    if (!prompt.trim()) return;

    dispatch({
      type: "UPDATE_STORY",
      payload: { storyPrompt: prompt, tone, targetPlatform: platform, targetDuration: duration },
    });

    setIsGenerating(true);

    try {
      // Call API to generate script from story prompt
      const res = await fetch("/api/studio/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          tone,
          platform,
          targetDuration: duration,
          brandId: state.brandId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.scenes) {
          dispatch({ type: "SET_SCENES", scenes: data.scenes });
        }
      }
    } catch (err) {
      console.error("Failed to generate script:", err);
    }

    setIsGenerating(false);
    dispatch({ type: "SET_STEP", step: 2 });
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        {/* Header */}
        <motion.div variants={staggerItem} className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#161514]">
              <Film className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-headline-sm text-[#161514]">What&apos;s your story?</h1>
              <p className="text-[13px] text-[#737373]">Describe your vision and we&apos;ll build the production plan.</p>
            </div>
          </div>
        </motion.div>

        {/* Prompt textarea */}
        <motion.div variants={staggerItem} className="mb-8">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A woman drives a Grand Cherokee through winding mountain roads at golden hour. She's confident, free, powerful. The camera follows from multiple angles — aerial shots of the road, close-ups of her hands on the wheel, reflections in the window. End with her stepping out at a viewpoint overlooking the valley..."
            rows={6}
            className="w-full bg-white border border-[rgba(22,21,20,0.10)] rounded-lg px-5 py-4 text-[15px] text-[#161514] placeholder:text-[#a3a3a3] resize-none outline-none focus:border-[#161514] transition-colors leading-relaxed"
            autoFocus
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-[#a3a3a3]">Be descriptive — the more detail, the better the result.</p>
            <p className="text-[11px] mono text-[#a3a3a3]">{prompt.length} chars</p>
          </div>
        </motion.div>

        {/* Tone selection */}
        <motion.div variants={staggerItem} className="mb-8">
          <p className="label-caps mb-3">Tone & Mood</p>
          <div className="grid grid-cols-3 gap-3">
            {TONES.map((t) => (
              <motion.button
                key={t.id}
                onClick={() => setTone(t.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring.snappy}
                className={cn(
                  "relative overflow-hidden rounded-xl text-left transition-all h-28",
                  tone === t.id
                    ? "ring-2 ring-[#161514] ring-offset-2"
                    : "ring-0"
                )}
              >
                {/* Background image */}
                <img
                  src={t.image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Gradient overlay */}
                <div className={cn("absolute inset-0 bg-gradient-to-t", t.gradient)} />
                {/* Content */}
                <div className="relative z-10 flex flex-col justify-end h-full p-3">
                  <span className="text-white text-[14px] font-semibold">{t.label}</span>
                  <span className="text-white/60 text-[11px] mt-0.5">{t.description}</span>
                </div>
                {/* Selected check */}
                {tone === t.id && (
                  <div className="absolute top-2 right-2 z-10 flex items-center justify-center h-5 w-5 rounded-full bg-white">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#161514]" />
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Platform + Duration row */}
        <motion.div variants={staggerItem} className="flex gap-6 mb-10">
          {/* Platform */}
          <div className="flex-1">
            <p className="label-caps mb-3">Platform</p>
            <div className="flex gap-2">
              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[12px] transition-all",
                      platform === p.id
                        ? "border-[#161514] bg-[#161514] text-white font-medium"
                        : "border-[rgba(22,21,20,0.10)] bg-white text-[#737373] hover:border-[#161514]/30"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div>
            <p className="label-caps mb-3">Duration</p>
            <div className="flex gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-[12px] mono transition-all",
                    duration === d
                      ? "border-[#161514] bg-[#161514] text-white font-medium"
                      : "border-[rgba(22,21,20,0.10)] bg-white text-[#737373] hover:border-[#161514]/30"
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {d}s
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Continue button */}
        <motion.div variants={staggerItem}>
          <motion.button
            onClick={handleContinue}
            disabled={!prompt.trim() || isGenerating}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={spring.snappy}
            className={cn(
              "flex items-center justify-center gap-3 w-full py-4 rounded-lg text-[14px] font-semibold transition-all",
              prompt.trim()
                ? "bg-[#161514] text-white hover:bg-[#2a2928]"
                : "bg-[#F3F0EB] text-[#a3a3a3] cursor-not-allowed"
            )}
          >
            {isGenerating ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" />
                Generating script...
              </>
            ) : (
              <>
                Generate Script
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
