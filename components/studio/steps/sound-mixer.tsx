"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Music,
  Mic,
  Zap,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useStudio } from "../studio-context";
import { staggerContainer, staggerItem, spring } from "@/lib/motion";
import type { AudioLayer } from "../studio-types";
import { cn } from "@/lib/utils";

const AUDIO_TYPES = [
  { type: "music" as const, label: "Background Music", icon: Music, color: "#4D5D4B" },
  { type: "voiceover" as const, label: "Voiceover", icon: Mic, color: "#161514" },
  { type: "sfx" as const, label: "Sound Effect", icon: Zap, color: "#8b6914" },
];

export function SoundMixer() {
  const { state, dispatch } = useStudio();
  const [generating, setGenerating] = useState<string | null>(null);
  const [musicPrompt, setMusicPrompt] = useState("");

  const musicLayers = state.audioLayers.filter((l) => l.type === "music");
  const voiceoverLayers = state.audioLayers.filter((l) => l.type === "voiceover");
  const sfxLayers = state.audioLayers.filter((l) => l.type === "sfx");

  async function generateMusic() {
    if (!musicPrompt.trim()) return;
    setGenerating("music");

    try {
      const res = await fetch("/api/studio/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "music",
          prompt: musicPrompt,
          brandId: state.brandId,
          targetDuration: state.totalDuration,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const layer: AudioLayer = {
          id: `music-${Date.now()}`,
          type: "music",
          url: data.url,
          label: data.title || "Background Music",
          volume: 0.15,
          startSeconds: 0,
          durationSeconds: data.duration || state.totalDuration,
        };
        dispatch({ type: "ADD_AUDIO_LAYER", layer });
      }
    } catch (err) {
      console.error("Failed to generate music:", err);
    }

    setGenerating(null);
    setMusicPrompt("");
  }

  async function generateVoiceover() {
    setGenerating("voiceover");
    const fullScript = state.scenes.map((s) => s.dialog).filter(Boolean).join(" ");
    if (!fullScript) {
      setGenerating(null);
      return;
    }

    try {
      const res = await fetch("/api/studio/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "voiceover",
          text: fullScript,
          brandId: state.brandId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const layer: AudioLayer = {
          id: `vo-${Date.now()}`,
          type: "voiceover",
          url: data.url,
          label: "Main Voiceover",
          volume: 0.85,
          startSeconds: 0,
          durationSeconds: data.duration || state.totalDuration,
        };
        dispatch({ type: "ADD_AUDIO_LAYER", layer });
      }
    } catch (err) {
      console.error("Failed to generate voiceover:", err);
    }

    setGenerating(null);
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        {/* Header */}
        <motion.div variants={staggerItem} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Volume2 className="h-5 w-5 text-[#4D5D4B]" />
            <h2 className="text-headline-sm text-[#161514]">Sound Design</h2>
          </div>
          <p className="text-[13px] text-[#737373]">
            Add music, voiceover, and sound effects. Total duration: {formatTime(state.totalDuration)}
          </p>
        </motion.div>

        {/* Audio timeline visualization */}
        <motion.div variants={staggerItem} className="mb-8 bg-white border border-[rgba(22,21,20,0.08)] rounded-xl p-5">
          <div className="space-y-3">
            {/* Timeline ruler */}
            <div className="flex items-center justify-between px-20">
              <span className="mono text-[10px] text-[#a3a3a3]">0:00</span>
              <span className="mono text-[10px] text-[#a3a3a3]">{formatTime(state.totalDuration / 2)}</span>
              <span className="mono text-[10px] text-[#a3a3a3]">{formatTime(state.totalDuration)}</span>
            </div>

            {/* Lanes */}
            {AUDIO_TYPES.map(({ type, label, icon: Icon, color }) => {
              const layers = state.audioLayers.filter((l) => l.type === type);
              return (
                <div key={type} className="flex items-center gap-3">
                  <div className="w-16 flex items-center gap-1.5 shrink-0">
                    <Icon className="h-3.5 w-3.5 text-[#737373]" />
                    <span className="text-[10px] text-[#737373] uppercase tracking-wider">{type}</span>
                  </div>
                  <div className="flex-1 h-10 bg-[#FAF8F5] rounded-md relative overflow-hidden">
                    {layers.map((layer) => {
                      const startPercent = (layer.startSeconds / state.totalDuration) * 100;
                      const widthPercent = Math.min(
                        (layer.durationSeconds / state.totalDuration) * 100,
                        100 - startPercent
                      );
                      return (
                        <motion.div
                          key={layer.id}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={spring.smooth}
                          style={{
                            left: `${startPercent}%`,
                            width: `${widthPercent}%`,
                            backgroundColor: color,
                            originX: 0,
                          }}
                          className="absolute inset-y-1 rounded flex items-center px-2"
                        >
                          <span className="text-[9px] text-white font-medium truncate">
                            {layer.label}
                          </span>
                        </motion.div>
                      );
                    })}
                    {layers.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-[#a3a3a3]">
                        No {type} added
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Generate controls */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Music generator */}
          <motion.div variants={staggerItem} className="bg-white border border-[rgba(22,21,20,0.08)] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Music className="h-4 w-4 text-[#4D5D4B]" />
              <span className="text-[13px] font-medium text-[#161514]">Background Music</span>
            </div>
            <textarea
              value={musicPrompt}
              onChange={(e) => setMusicPrompt(e.target.value)}
              placeholder="Describe the mood: warm lo-fi beats, gentle acoustic guitar, cozy afternoon feeling..."
              rows={3}
              className="w-full bg-[#FAF8F5] border border-[rgba(22,21,20,0.06)] rounded-lg px-3 py-2 text-[13px] text-[#161514] placeholder:text-[#a3a3a3] resize-none outline-none mb-3"
            />
            <button
              onClick={generateMusic}
              disabled={generating === "music" || !musicPrompt.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[#4D5D4B] text-white rounded-lg text-[12px] font-medium disabled:opacity-50 hover:bg-[#3d4a3b] transition-colors"
            >
              {generating === "music" ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Generate Music</>
              )}
            </button>
          </motion.div>

          {/* Voiceover generator */}
          <motion.div variants={staggerItem} className="bg-white border border-[rgba(22,21,20,0.08)] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Mic className="h-4 w-4 text-[#161514]" />
              <span className="text-[13px] font-medium text-[#161514]">Voiceover</span>
            </div>
            <div className="bg-[#FAF8F5] border border-[rgba(22,21,20,0.06)] rounded-lg px-3 py-2 text-[12px] text-[#737373] mb-3 max-h-24 overflow-y-auto">
              {state.scenes.map((s) => s.dialog).filter(Boolean).join(" ") || (
                <span className="text-[#a3a3a3] italic">No dialog written in scenes yet.</span>
              )}
            </div>
            <button
              onClick={generateVoiceover}
              disabled={generating === "voiceover" || !state.scenes.some((s) => s.dialog)}
              className="flex items-center gap-2 px-4 py-2 bg-[#161514] text-white rounded-lg text-[12px] font-medium disabled:opacity-50 hover:bg-[#2a2928] transition-colors"
            >
              {generating === "voiceover" ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Generate Voiceover</>
              )}
            </button>
          </motion.div>
        </div>

        {/* Audio layers list */}
        {state.audioLayers.length > 0 && (
          <motion.div variants={staggerItem} className="mb-8">
            <p className="label-caps text-[10px] mb-3">Audio Layers</p>
            <div className="space-y-2">
              {state.audioLayers.map((layer) => (
                <div
                  key={layer.id}
                  className="flex items-center gap-4 bg-white border border-[rgba(22,21,20,0.08)] rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {layer.type === "music" && <Music className="h-4 w-4 text-[#4D5D4B] shrink-0" />}
                    {layer.type === "voiceover" && <Mic className="h-4 w-4 text-[#161514] shrink-0" />}
                    {layer.type === "sfx" && <Zap className="h-4 w-4 text-[#8b6914] shrink-0" />}
                    <span className="text-[13px] text-[#161514] truncate">{layer.label}</span>
                    <span className="mono text-[10px] text-[#a3a3a3]">{formatTime(layer.durationSeconds)}</span>
                  </div>

                  {/* Volume slider */}
                  <div className="flex items-center gap-2 w-40">
                    <VolumeX className="h-3 w-3 text-[#a3a3a3]" />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={layer.volume * 100}
                      onChange={(e) =>
                        dispatch({ type: "UPDATE_AUDIO_LAYER", id: layer.id, updates: { volume: parseInt(e.target.value) / 100 } })
                      }
                      className="flex-1 h-1 accent-[#161514]"
                    />
                    <Volume2 className="h-3 w-3 text-[#a3a3a3]" />
                    <span className="mono text-[10px] text-[#a3a3a3] w-8 text-right">{Math.round(layer.volume * 100)}%</span>
                  </div>

                  <button
                    onClick={() => dispatch({ type: "REMOVE_AUDIO_LAYER", id: layer.id })}
                    className="text-[#a3a3a3] hover:text-[#ba1a1a] transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <motion.div variants={staggerItem} className="flex items-center justify-between">
          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 6 })}
            className="flex items-center gap-2 px-5 py-2.5 border border-[rgba(22,21,20,0.10)] rounded-lg text-[13px] text-[#737373] hover:text-[#161514] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Scenes
          </button>
          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 8 })}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#161514] text-white rounded-lg text-[13px] font-medium hover:bg-[#2a2928] transition-colors"
          >
            Export & Render <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
