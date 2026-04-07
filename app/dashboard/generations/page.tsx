"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowRight, Sparkles, Play } from "lucide-react";
import { spring } from "@/lib/motion";

type Generation = {
  id: string;
  type: string;
  status: string;
  title: string | null;
  language: string;
  created_at: string;
  generation_assets: Array<{
    id: string;
    type: string;
    public_url: string | null;
    thumbnail_url: string | null;
    variant_number: number;
    aspect_ratio?: string;
  }>;
};

type StatusFilter = "all" | "completed" | "processing" | "failed";

const FILTERS: { key: StatusFilter; label: string; dot?: string }[] = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed", dot: "bg-[#4D5D4B]" },
  { key: "processing", label: "Processing", dot: "bg-[#FBBF24]" },
  { key: "failed", label: "Failed", dot: "bg-[#EF4444]" },
];

function formatType(type: string): string {
  const map: Record<string, string> = {
    video: "VIDEO", image: "IMAGE", ugc: "UGC", ugc_video: "UGC",
    carousel: "CAROUSEL", story: "STORY", ad_image: "IMAGE",
    ad_video: "VIDEO", static_ad: "IMAGE", video_ad: "VIDEO",
    competitor_research: "RESEARCH", script: "SCRIPT",
  };
  return map[type] || type.replace(/_/g, " ").toUpperCase();
}

function typeBadge(type: string) {
  const t = formatType(type);
  if (t === "VIDEO" || t === "UGC") return { label: t, cls: "bg-[#6C5CE7]/10 text-[#6C5CE7]" };
  if (t === "IMAGE") return { label: t, cls: "bg-[#FF7675]/10 text-[#FF7675]" };
  if (t === "RESEARCH") return { label: t, cls: "bg-[#3B82F6]/10 text-[#3B82F6]" };
  if (t === "CAMPAIGN") return { label: t, cls: "bg-[#4D5D4B]/10 text-[#4D5D4B]" };
  return { label: t, cls: "bg-[#F3F4F6] text-[#6B7280]" };
}

function relativeTime(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

function estimateCardHeight(gen: Generation): number {
  const hasMedia = gen.generation_assets.some((a) => (a.type === "image" || a.type === "thumbnail" || a.type === "video") && a.public_url);
  const aspect = gen.generation_assets[0]?.aspect_ratio;
  const text = 64;
  if (aspect === "16:9") return 180 + text;
  if (aspect === "9:16") return 380 + text;
  if (hasMedia) return 260 + text;
  return 120 + text;
}

function getCount(gens: Generation[], key: StatusFilter): number {
  if (key === "all") return gens.length;
  return gens.filter((g) => g.status === key || (key === "processing" && g.status === "generating")).length;
}

/* ── Skeleton ── */
function LoadingSkeleton() {
  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="shimmer h-8 w-32 rounded-xl" />
          <div className="shimmer h-4 w-48 rounded-lg" />
        </div>
        <div className="shimmer h-10 w-32 rounded-full" />
      </div>
      <div className="flex gap-2">
        {[60, 80, 80, 60].map((w, i) => <div key={i} className="shimmer h-9 rounded-full" style={{ width: w }} />)}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden">
            <div className="shimmer" style={{ height: [240, 300, 200, 280, 320, 220, 260, 340][i] }} />
            <div className="p-3 space-y-2">
              <div className="shimmer h-4 w-3/4 rounded-lg" />
              <div className="shimmer h-3 w-1/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Gallery Card ── */
function GalleryCard({ gen, index }: { gen: Generation; index: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  const img = gen.generation_assets.find((a) => (a.type === "image" || a.type === "thumbnail") && a.public_url);
  const vid = gen.generation_assets.find((a) => a.type === "video" && a.public_url);
  const composedVideo = gen.generation_assets.find((a) => a.type === "video" && a.public_url && (a as Record<string, unknown>).metadata && ((a as Record<string, unknown>).metadata as Record<string, string>)?.asset_category === "composed_video");
  const previewUrl = img?.thumbnail_url || img?.public_url;
  const videoUrl = composedVideo?.public_url || vid?.public_url;
  const hasMedia = previewUrl || videoUrl;
  // Use actual content type, not generation type (which is often wrong)
  const actualType = videoUrl ? "video" : img ? "image" : gen.type;
  const badge = typeBadge(actualType);
  const isProcessing = gen.status === "processing" || gen.status === "generating";

  useEffect(() => {
    if (hovered && videoRef.current && videoUrl && !previewUrl) {
      videoRef.current.play().catch(() => {});
    } else if (!hovered && videoRef.current) {
      videoRef.current.pause();
    }
  }, [hovered, videoUrl, previewUrl]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
    >
      <Link
        href={`/dashboard/generations/${gen.id}`}
        className="block group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="rounded-2xl overflow-hidden border border-[#F0F0F0] bg-white transition-all duration-300 hover:shadow-medium hover:-translate-y-1">
          {/* Media */}
          {hasMedia ? (
            <div className="relative overflow-hidden">
              {previewUrl ? (
                <img src={previewUrl} alt="" loading="lazy"
                  className="w-full max-h-[400px] object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              ) : videoUrl ? (
                <video ref={videoRef} src={videoUrl} muted loop playsInline preload="metadata"
                  className="w-full max-h-[400px] object-cover" />
              ) : null}

              {/* Hover overlay with info */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300",
                hovered ? "opacity-100" : "opacity-0"
              )}>
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-[13px] font-semibold text-white truncate">{gen.title || formatType(gen.type)}</p>
                  <p className="text-[11px] text-white/60 mt-0.5">{relativeTime(gen.created_at)} ago</p>
                </div>
              </div>

              {/* Video play */}
              {videoUrl && (
                <div className={cn(
                  "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                  hovered ? "opacity-100" : "opacity-0"
                )}>
                  <div className="h-12 w-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <Play className="h-5 w-5 text-[#1A1A1A] ml-0.5" fill="currentColor" />
                  </div>
                </div>
              )}

              {/* Type badge — top right */}
              <span className={cn("absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm", badge.cls)}>
                {badge.label}
              </span>

              {/* Processing shimmer */}
              {isProcessing && (
                <div className="absolute inset-0 shimmer opacity-30" />
              )}
            </div>
          ) : (
            /* No media */
            <div className="flex items-center justify-center h-32 bg-gradient-to-br from-[#F3F4F6] to-[#E5E7EB]">
              <span className={cn("text-[11px] font-bold px-3 py-1 rounded-full", badge.cls)}>{badge.label}</span>
            </div>
          )}

          {/* Title + metadata */}
          <div className="p-3">
            <p className="text-[14px] font-bold text-[#1A1A1A] truncate">{gen.title || formatType(gen.type)}</p>
            <span className="text-[11px] text-[#9CA3AF]">{relativeTime(gen.created_at)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Masonry ── */
function MasonryGrid({ items }: { items: Generation[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    function update() {
      const w = ref.current?.offsetWidth || window.innerWidth;
      setCols(w < 640 ? 1 : w < 1024 ? 2 : w < 1440 ? 3 : 3);
    }
    update();
    const observer = new ResizeObserver(update);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const columns: Generation[][] = Array.from({ length: cols }, () => []);
  const heights = new Array(cols).fill(0);
  for (const item of items) {
    const shortest = heights.indexOf(Math.min(...heights));
    columns[shortest].push(item);
    heights[shortest] += estimateCardHeight(item);
  }

  return (
    <div ref={ref} className="flex gap-4">
      {columns.map((col, ci) => (
        <div key={ci} className="flex-1 space-y-4">
          {col.map((gen, i) => <GalleryCard key={gen.id} gen={gen} index={ci + i * cols} />)}
        </div>
      ))}
    </div>
  );
}

/* ── Main ── */
export default function GenerationsPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/generations");
        if (res.ok) { const data = await res.json(); setGenerations(data.generations || []); }
      } catch (e) { console.error("Failed to load generations:", e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    // Only show generations that have at least one asset (filter out chat-only sessions)
    const withAssets = generations.filter((g) => g.generation_assets && g.generation_assets.length > 0);
    if (activeFilter === "all") return withAssets;
    return withAssets.filter((g) => g.status === activeFilter || (activeFilter === "processing" && g.status === "generating"));
  }, [generations, activeFilter]);

  if (loading) return <LoadingSkeleton />;

  // Stats
  // Only count generations with actual assets (filter out chat-only sessions)
  const gensWithAssets = generations.filter((g) => g.generation_assets && g.generation_assets.length > 0);
  const totalImages = gensWithAssets.reduce((sum, g) => sum + g.generation_assets.filter((a) => a.type === "image").length, 0);
  const totalVideos = gensWithAssets.reduce((sum, g) => sum + g.generation_assets.filter((a) => a.type === "video").length, 0);

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] text-[#1A1A1A]">Gallery</h1>
          <p className="text-[15px] text-[#6B7280] mt-1">
            {gensWithAssets.length} creation{gensWithAssets.length !== 1 ? "s" : ""}
            {totalImages > 0 && <span className="text-[#FF7675]"> · {totalImages} images</span>}
            {totalVideos > 0 && <span className="text-[#6C5CE7]"> · {totalVideos} videos</span>}
          </p>
        </div>
        <Link href="/dashboard" className="btn-primary text-[14px]">
          <Sparkles className="h-4 w-4" />
          Create New
        </Link>
      </div>

      {/* Filter pills with colored dots */}
      {gensWithAssets.length > 0 && (
        <div className="flex gap-2 mb-8">
          {FILTERS.map((f) => {
            const active = activeFilter === f.key;
            const count = getCount(gensWithAssets, f.key);
            return (
              <button key={f.key} onClick={() => setActiveFilter(f.key)}
                className={cn(
                  "px-4 py-2 rounded-full text-[13px] font-semibold flex items-center gap-2 transition-all",
                  active ? "bg-[#1A1A1A] text-white" : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A1A]"
                )}>
                {f.dot && <span className={cn("w-2 h-2 rounded-full", active ? "bg-white" : f.dot)} />}
                {f.label}
                <span className={cn("text-[11px]", active ? "text-white/50" : "text-[#D1D5DB]")}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-6">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#FF7675]/10 to-[#6C5CE7]/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-[#6B7280]" />
            </div>
          </div>
          <h3 className="text-[22px] font-bold text-[#1A1A1A]">Your gallery is empty</h3>
          <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-[#6B7280]">
            Create your first AI-powered ad and it will appear here in your personal gallery.
          </p>
          <Link href="/dashboard" className="btn-primary mt-8 text-[15px] px-8 py-3">
            <Sparkles className="h-4 w-4" />
            Create your first ad
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-[15px] text-[#6B7280]">No {activeFilter} generations found.</p>
          <button onClick={() => setActiveFilter("all")}
            className="mt-3 text-[14px] font-semibold text-[#4D5D4B] hover:underline underline-offset-2">
            View all
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={activeFilter} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <MasonryGrid items={filtered} />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
