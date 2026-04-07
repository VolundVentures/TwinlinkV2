"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  GripVertical,
  Play,
  Image,
  Mic,
  Users,
  Film,
  Clock,
  Sparkles,
  RefreshCw,
  ChevronDown,
  Music,
  Type,
  ArrowRight,
} from "lucide-react";

/* ---- Types ---- */

type Scene = {
  scene_number: number;
  scene_type: string;
  description: string;
  image_prompt?: string;
  duration_seconds: number;
  audio_notes?: string;
  text_overlay?: string;
  suggested_model?: string;
  has_own_audio?: boolean;
  status: "pending" | "generating" | "ready";
  image_url?: string;
  video_url?: string;
};

type Storyboard = {
  title: string;
  scenes: Scene[];
  total_duration_seconds: number;
  voiceover_text?: string;
  music_mood?: string;
  aspect_ratio: string;
};

/* ---- Scene type icons ---- */

const SCENE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  hook: Sparkles,
  talking_head: Users,
  product_broll: Image,
  lifestyle: Film,
  testimonial: Mic,
  cta: ArrowRight,
  transition: Play,
};

const SCENE_TYPE_LABELS: Record<string, string> = {
  hook: "HOOK",
  talking_head: "TALKING HEAD",
  product_broll: "PRODUCT B-ROLL",
  lifestyle: "LIFESTYLE",
  testimonial: "TESTIMONIAL",
  cta: "CALL TO ACTION",
  transition: "TRANSITION",
};

/* ---- Component ---- */

export default function StoryboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const generationId = searchParams.get("generationId");

  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [expandedScene, setExpandedScene] = useState<number | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    async function loadStoryboard() {
      if (!generationId) { setLoading(false); return; }
      try {
        const res = await fetch(`/api/generations/${generationId}`);
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        const brief = data.generation?.creative_brief;
        if (brief?.scenes) {
          setStoryboard(brief as Storyboard);
        }
      } catch (err) {
        console.error("Failed to load storyboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStoryboard();
  }, [generationId]);

  function moveScene(from: number, to: number) {
    if (!storyboard) return;
    const scenes = [...storyboard.scenes];
    const [moved] = scenes.splice(from, 1);
    scenes.splice(to, 0, moved);
    // Renumber
    scenes.forEach((s, i) => { s.scene_number = i + 1; });
    setStoryboard({ ...storyboard, scenes });
  }

  function updateScene(index: number, updates: Partial<Scene>) {
    if (!storyboard) return;
    const scenes = [...storyboard.scenes];
    scenes[index] = { ...scenes[index], ...updates };
    setStoryboard({ ...storyboard, scenes });
  }

  function removeScene(index: number) {
    if (!storyboard) return;
    const scenes = storyboard.scenes.filter((_, i) => i !== index);
    scenes.forEach((s, i) => { s.scene_number = i + 1; });
    setStoryboard({
      ...storyboard,
      scenes,
      total_duration_seconds: scenes.reduce((s, sc) => s + sc.duration_seconds, 0),
    });
  }

  async function handleRender() {
    if (!storyboard || !generationId) return;
    setRendering(true);
    // Navigate back to generate page which will continue the agent loop
    router.push(`/dashboard/generate?generationId=${generationId}&action=render_storyboard`);
  }

  const totalDuration = storyboard?.scenes.reduce((s, sc) => s + sc.duration_seconds, 0) || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="h-6 w-6 animate-spin mx-auto mb-3 border-2 border-[#161514] border-t-transparent rounded-full" />
          <p className="label-caps">Loading storyboard...</p>
        </div>
      </div>
    );
  }

  if (!storyboard) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Film className="h-8 w-8 text-[#a3a3a3] mb-4" />
        <p className="text-[15px] font-semibold text-[#161514]">No storyboard found</p>
        <p className="text-sm text-[#737373] mt-1">Generate a video ad to see the storyboard editor.</p>
        <Link href="/dashboard" className="mt-4 mono text-xs uppercase tracking-[0.06em] text-[#4D5D4B] hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[#737373] hover:text-[#161514] transition-colors mb-3">
            <ArrowLeft className="h-4 w-4" />
            <span className="mono text-xs uppercase tracking-[0.06em]">Back</span>
          </button>
          <p className="label-caps mb-2">Storyboard Editor</p>
          <h1 className="text-headline text-[#161514]">{storyboard.title}</h1>
        </div>
        <div className="text-end">
          <p className="label-caps mb-1">Total Duration</p>
          <p className="text-headline-sm mono text-[#161514]">{totalDuration}s</p>
        </div>
      </div>

      {/* Metadata strip */}
      <div className="data-strip mb-8">
        <span>{storyboard.scenes.length} <strong>Scenes</strong></span>
        <span>{storyboard.aspect_ratio} <strong>Aspect</strong></span>
        {storyboard.music_mood && <span><Music className="inline h-3 w-3 me-1" /><strong>{storyboard.music_mood}</strong></span>}
      </div>

      {/* Scene cards */}
      <div className="space-y-3">
        {storyboard.scenes.map((scene, index) => {
          const Icon = SCENE_TYPE_ICONS[scene.scene_type] || Film;
          const typeLabel = SCENE_TYPE_LABELS[scene.scene_type] || scene.scene_type.toUpperCase();
          const isExpanded = expandedScene === index;

          return (
            <div
              key={scene.scene_number}
              className={cn(
                "bg-white transition-all",
                dragIndex === index && "opacity-50",
                isExpanded && "shadow-ambient"
              )}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={() => { if (dragIndex !== null && dragIndex !== index) moveScene(dragIndex, index); setDragIndex(null); }}
              onDragEnd={() => setDragIndex(null)}
            >
              {/* Scene header */}
              <button
                onClick={() => setExpandedScene(isExpanded ? null : index)}
                className="flex items-center gap-4 w-full px-5 py-4 text-start"
              >
                {/* Drag handle */}
                <GripVertical className="h-4 w-4 text-[#d4d4d4] cursor-grab shrink-0" />

                {/* Scene number */}
                <span className="mono text-lg font-bold text-[#161514] w-8 shrink-0">
                  {String(scene.scene_number).padStart(2, "0")}
                </span>

                {/* Type badge */}
                <span className="inline-flex items-center gap-1.5 bg-[#f2f4f4] px-3 py-1 shrink-0">
                  <Icon className="h-3.5 w-3.5 text-[#737373]" />
                  <span className="mono text-[10px] uppercase tracking-[0.06em] text-[#737373]">{typeLabel}</span>
                </span>

                {/* Description */}
                <span className="flex-1 text-[14px] text-[#161514] truncate">
                  {scene.description}
                </span>

                {/* Duration */}
                <span className="flex items-center gap-1 shrink-0">
                  <Clock className="h-3.5 w-3.5 text-[#a3a3a3]" />
                  <span className="mono text-xs text-[#737373]">{scene.duration_seconds}s</span>
                </span>

                {/* Model */}
                {scene.suggested_model && (
                  <span className="mono text-[10px] text-[#a3a3a3] uppercase shrink-0">
                    {scene.suggested_model}
                  </span>
                )}

                <ChevronDown className={cn("h-4 w-4 text-[#a3a3a3] transition-transform shrink-0", isExpanded && "rotate-180")} />
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-0 border-t border-[rgba(22,21,20,0.06)]">
                  <div className="grid grid-cols-2 gap-6 mt-4">
                    {/* Left — image prompt */}
                    <div>
                      <p className="label-caps mb-2">Image Prompt</p>
                      <textarea
                        value={scene.image_prompt || ""}
                        onChange={(e) => updateScene(index, { image_prompt: e.target.value })}
                        rows={3}
                        className="w-full bg-[#f2f4f4] text-[13px] text-[#161514] p-3 outline-none resize-none mono"
                        placeholder="Describe the visual for this scene..."
                      />
                    </div>

                    {/* Right — audio + overlay */}
                    <div className="space-y-4">
                      <div>
                        <p className="label-caps mb-2">Audio Notes</p>
                        <input
                          value={scene.audio_notes || ""}
                          onChange={(e) => updateScene(index, { audio_notes: e.target.value })}
                          className="w-full bg-[#f2f4f4] text-[13px] text-[#161514] p-3 outline-none mono"
                          placeholder="Voiceover text or music cue..."
                        />
                      </div>
                      <div>
                        <p className="label-caps mb-2">Text Overlay</p>
                        <input
                          value={scene.text_overlay || ""}
                          onChange={(e) => updateScene(index, { text_overlay: e.target.value })}
                          className="w-full bg-[#f2f4f4] text-[13px] text-[#161514] p-3 outline-none mono"
                          placeholder="On-screen text..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Duration slider */}
                  <div className="mt-4 flex items-center gap-4">
                    <p className="label-caps shrink-0">Duration</p>
                    <input
                      type="range"
                      min={2}
                      max={15}
                      value={scene.duration_seconds}
                      onChange={(e) => updateScene(index, { duration_seconds: parseInt(e.target.value) })}
                      className="flex-1 accent-[#4D5D4B]"
                    />
                    <span className="mono text-sm font-semibold text-[#161514] w-8 text-end">{scene.duration_seconds}s</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[rgba(22,21,20,0.06)]">
                    <button className="mono text-[11px] uppercase tracking-[0.06em] text-[#737373] hover:text-[#161514] transition-colors flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                    </button>
                    <button
                      onClick={() => removeScene(index)}
                      className="mono text-[11px] uppercase tracking-[0.06em] text-[#ba1a1a] hover:text-[#dc2626] transition-colors"
                    >
                      Remove Scene
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Voiceover section */}
      {storyboard.voiceover_text && (
        <div className="mt-8 bg-white p-6">
          <p className="label-caps mb-3">Voiceover Script (B-Roll Sections)</p>
          <p className="text-[14px] text-[#525252] leading-relaxed italic">
            &ldquo;{storyboard.voiceover_text}&rdquo;
          </p>
        </div>
      )}

      {/* Bottom action bar */}
      <div className="fixed bottom-0 start-[200px] end-0 bg-white/95 backdrop-blur-sm border-t border-[rgba(22,21,20,0.06)] px-8 py-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-6">
          <span className="mono text-xs text-[#737373]">{storyboard.scenes.length} scenes</span>
          <span className="mono text-xs text-[#737373]">{totalDuration}s total</span>
          <span className="mono text-xs text-[#737373]">{storyboard.aspect_ratio}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="mono text-xs uppercase tracking-[0.06em] border border-[#161514] px-6 py-2.5 text-[#161514] hover:bg-[#161514] hover:text-white transition-colors"
          >
            Save Draft
          </button>
          <button
            onClick={handleRender}
            disabled={rendering}
            className="mono text-xs uppercase tracking-[0.06em] bg-[#4D5D4B] text-white px-6 py-2.5 hover:bg-[#3d4a3b] transition-colors disabled:opacity-50"
          >
            {rendering ? "Rendering..." : "Render Video"}
          </button>
        </div>
      </div>
    </div>
  );
}
