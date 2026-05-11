"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "processing", label: "Processing" },
  { key: "failed", label: "Failed" },
];

function formatTypeLabel(type: string): string {
  if (!type) return "";
  return type.replace(/_/g, " ").toLowerCase();
}

function relativeTime(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function pickMedia(g: Generation): {
  kind: "image" | "video" | "none";
  url?: string;
  aspect?: string;
} {
  const video = g.generation_assets.find(
    (a) => a.type === "video" && a.public_url
  );
  if (video?.public_url) {
    return {
      kind: "video",
      url: video.public_url,
      aspect: video.aspect_ratio,
    };
  }
  const image = g.generation_assets.find(
    (a) => (a.type === "image" || a.type === "thumbnail") && a.public_url
  );
  if (image?.public_url) {
    return {
      kind: "image",
      url: image.thumbnail_url || image.public_url,
      aspect: image.aspect_ratio,
    };
  }
  return { kind: "none" };
}

function getCount(list: Generation[], key: StatusFilter): number {
  if (key === "all") return list.length;
  if (key === "processing")
    return list.filter((g) => g.status === "processing" || g.status === "generating").length;
  return list.filter((g) => g.status === key).length;
}

function aspectClass(aspect?: string): string {
  if (aspect === "9:16") return "aspect-[9/16]";
  if (aspect === "1:1") return "aspect-square";
  if (aspect === "21:9") return "aspect-[21/9]";
  if (aspect === "4:3") return "aspect-[4/3]";
  if (aspect === "3:4") return "aspect-[3/4]";
  return "aspect-video";
}

function GalleryCard({ gen }: { gen: Generation }) {
  const media = pickMedia(gen);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (hovered) el.play().catch(() => {});
    else {
      el.pause();
      el.currentTime = 0;
    }
  }, [hovered]);

  return (
    <div
      className="group block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={`/dashboard/director?resume=${gen.id}`} className="block">
        <div
          className={cn(
            "relative overflow-hidden border border-neutral-200 bg-neutral-100 transition-colors group-hover:border-neutral-900",
            aspectClass(media.aspect)
          )}
        >
          {media.kind === "image" && media.url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={media.url}
              alt={gen.title || "film"}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          )}
          {media.kind === "video" && media.url && (
            <video
              ref={videoRef}
              src={media.url}
              muted
              loop
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          )}
          {media.kind === "none" && (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-400">
                {gen.status === "failed" ? "Failed" : "In progress"}
              </span>
            </div>
          )}
        </div>
      </Link>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-serif text-[14px] leading-tight text-neutral-900">
            {gen.title || "Untitled"}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
            {formatTypeLabel(gen.type)} &middot; {relativeTime(gen.created_at)}
          </p>
        </div>
        <Link
          href={`/dashboard/director?resume=${gen.id}`}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900"
        >
          Resume →
        </Link>
      </div>
    </div>
  );
}

export default function GenerationsPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/generations");
        if (res.ok) {
          const data = await res.json();
          setGenerations(data.generations || []);
        }
      } catch (e) {
        console.error("Failed to load generations:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return generations;
    if (activeFilter === "processing")
      return generations.filter(
        (g) => g.status === "processing" || g.status === "generating"
      );
    return generations.filter((g) => g.status === activeFilter);
  }, [generations, activeFilter]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-10 py-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          Loading
        </p>
      </div>
    );
  }

  const totalImages = generations.reduce(
    (sum, g) => sum + g.generation_assets.filter((a) => a.type === "image").length,
    0
  );
  const totalVideos = generations.reduce(
    (sum, g) => sum + g.generation_assets.filter((a) => a.type === "video").length,
    0
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-10 py-14 space-y-10">
      {/* Header */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          TwinLink &middot; Gallery
        </p>
        <div className="mt-4 flex items-end justify-between gap-6">
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-neutral-900">
            Every film.
            <br />
            Every frame.
          </h1>
          <Link
            href="/dashboard/director"
            className="inline-flex h-11 items-center rounded-none bg-neutral-900 px-5 font-mono text-[10px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
          >
            Start a new film →
          </Link>
        </div>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          {generations.length} film{generations.length !== 1 ? "s" : ""}
          {totalImages > 0 && ` · ${totalImages} images`}
          {totalVideos > 0 && ` · ${totalVideos} videos`}
        </p>
      </section>

      {/* Filters */}
      {generations.length > 0 && (
        <section className="border-t border-neutral-200 pt-6">
          <div className="flex gap-6">
            {FILTERS.map((f) => {
              const active = activeFilter === f.key;
              const count = getCount(generations, f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveFilter(f.key)}
                  className={cn(
                    "flex items-center gap-2 border-b-2 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
                    active
                      ? "border-neutral-900 text-neutral-900"
                      : "border-transparent text-neutral-500 hover:text-neutral-900"
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "tabular-nums",
                      active ? "text-neutral-900" : "text-neutral-400"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <section className="border-t border-neutral-200 py-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            {generations.length === 0 ? "Empty gallery" : `No ${activeFilter} films`}
          </p>
          <h3 className="mt-4 font-serif text-3xl leading-tight text-neutral-900">
            {generations.length === 0
              ? "Direct your first film."
              : "Nothing here yet."}
          </h3>
          {generations.length === 0 ? (
            <Link
              href="/dashboard/director"
              className="mt-8 inline-flex h-11 items-center rounded-none bg-neutral-900 px-5 font-mono text-[10px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
            >
              Start in director →
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500 hover:text-neutral-900"
            >
              View all
            </button>
          )}
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-3">
          {filtered.map((gen) => (
            <GalleryCard key={gen.id} gen={gen} />
          ))}
        </section>
      )}
    </div>
  );
}
