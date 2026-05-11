"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Download,
  Share2,
  ImageIcon,
  Play,
  FileText,
  Volume2,
  Trash2,
} from "lucide-react";

/* ------------------------------------------------
   Types
   ------------------------------------------------ */

type GenerationAsset = {
  id: string;
  type: string;
  aspect_ratio: string | null;
  public_url: string | null;
  creative_rationale: string | null;
  variant_number: number;
  metadata: {
    headline?: string;
    body?: string;
    cta?: string;
    concept?: string;
    concept_name?: string;
    title?: string;
    full_script?: string;
    asset_category?: string;
    mode?: string;
    model?: string;
    prompt?: string;
    duration_seconds?: number;
  };
};

type Generation = {
  id: string;
  type: string;
  status: string;
  title: string | null;
  language: string;
  prompt: string | null;
  creative_brief: Record<string, unknown>;
  credits_used: number;
  created_at: string;
  completed_at: string | null;
  generation_assets: GenerationAsset[];
};

/* ------------------------------------------------
   Helpers
   ------------------------------------------------ */

const ASSET_TYPE_LABELS: Record<string, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  script: "Script",
  thumbnail: "Thumbnail",
};

function getAudioLabel(asset: GenerationAsset): string {
  const category = asset.metadata?.asset_category as string | undefined;
  if (category === "background_music") return "Music";
  return "Voiceover";
}

const ASSET_TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <ImageIcon className="size-4" />,
  video: <Play className="size-4" />,
  audio: <Volume2 className="size-4" />,
  script: <FileText className="size-4" />,
  thumbnail: <ImageIcon className="size-4" />,
};

function getAssetLabel(asset: GenerationAsset, index: number): string {
  if (asset.metadata?.concept_name) return asset.metadata.concept_name;
  if (asset.metadata?.title) return asset.metadata.title;
  if (asset.type === "audio") return getAudioLabel(asset);
  if (asset.metadata?.asset_category === "composed_video") return "Final Video";
  const typeLabel = ASSET_TYPE_LABELS[asset.type] || asset.type;
  return `${typeLabel} ${index + 1}`;
}

function getFileExtension(type: string): string {
  switch (type) {
    case "video":
      return "mp4";
    case "audio":
      return "mp3";
    case "script":
      return "txt";
    default:
      return "png";
  }
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "\u2014";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

function getResolutionLabel(asset: GenerationAsset | null): string {
  if (!asset) return "\u2014";
  if (asset.aspect_ratio) {
    switch (asset.aspect_ratio) {
      case "1:1":
        return "1080 \u00d7 1080";
      case "9:16":
        return "1080 \u00d7 1920";
      case "16:9":
        return "1920 \u00d7 1080";
      case "4:5":
        return "1080 \u00d7 1350";
      default:
        return asset.aspect_ratio;
    }
  }
  return "\u2014";
}

function getModelEngine(type: string): string {
  switch (type) {
    case "video":
      return "TwinLink V2";
    case "image":
      return "TwinLink V2";
    case "audio":
      return "TwinLink Audio";
    default:
      return "TwinLink V2";
  }
}

/* ------------------------------------------------
   Badge colors
   ------------------------------------------------ */

const TYPE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  VIDEO: { bg: "#6C5CE7", text: "#FFFFFF" },
  IMAGE: { bg: "#FF7675", text: "#FFFFFF" },
  UGC: { bg: "#4D5D4B", text: "#FFFFFF" },
  RESEARCH: { bg: "#3B82F6", text: "#FFFFFF" },
  AUDIO: { bg: "#6C5CE7", text: "#FFFFFF" },
  CAMPAIGN: { bg: "#4D5D4B", text: "#FFFFFF" },
};

function getTypeBadgeStyle(label: string): React.CSSProperties {
  const colors = TYPE_BADGE_COLORS[label] || { bg: "#4D5D4B", text: "#FFFFFF" };
  return { backgroundColor: colors.bg, color: colors.text };
}

/* ------------------------------------------------
   Page Component
   ------------------------------------------------ */

export default function GenerationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const generationId = params.generationId as string;

  const [generation, setGeneration] = useState<Generation | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<GenerationAsset | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/generations/${generationId}`);
        if (res.ok) {
          const data = await res.json();
          setGeneration(data.generation);
          if (data.generation?.generation_assets?.length) {
            // Prefer composed video as default hero, then any video, then first asset
            const assets = data.generation.generation_assets as GenerationAsset[];
            const composedVideo = assets.find((a) => a.metadata?.asset_category === "composed_video");
            const anyVideo = assets.find((a) => a.type === "video");
            const anyImage = assets.find((a) => a.type === "image");
            setSelectedAsset(composedVideo || anyVideo || anyImage || assets[0]);
          }
        }
      } catch (error) {
        console.error("Failed to load generation:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [generationId]);

  const assets = useMemo(() => generation?.generation_assets || [], [generation]);

  function handleDownload(url: string, asset: GenerationAsset, variant: number) {
    // Scripts have script:// URLs — download as JSON from metadata
    if (url.startsWith("script://") || asset.type === "script") {
      const scriptData = asset.metadata || {};
      const blob = new Blob([JSON.stringify(scriptData, null, 2)], { type: "application/json" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `twinlink-script-${variant}.json`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      return;
    }
    // Use server-side proxy to bypass CORS and force download via Content-Disposition
    const proxyUrl = `/api/download?url=${encodeURIComponent(url)}`;
    const a = document.createElement("a");
    a.href = proxyUrl;
    a.click();
  }

  function handleDownloadAll() {
    assets.forEach((asset, index) => {
      if (asset.public_url) {
        handleDownload(asset.public_url, asset, index + 1);
      }
    });
  }

  /* ---------- Loading skeleton ---------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-white px-8 py-6 animate-fade-in-up">
        {/* Back link skeleton */}
        <div className="mb-8">
          <div className="h-5 w-32 rounded-md bg-[#F0F0F0] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left column skeleton */}
          <div className="lg:col-span-3 space-y-5">
            <div className="aspect-video w-full rounded-2xl bg-[#F0F0F0] animate-pulse" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 w-16 shrink-0 rounded-xl bg-[#F0F0F0] animate-pulse" />
              ))}
            </div>
          </div>
          {/* Right column skeleton */}
          <div className="lg:col-span-2 space-y-5">
            <div className="h-6 w-20 rounded-full bg-[#F0F0F0] animate-pulse" />
            <div className="h-4 w-28 rounded bg-[#F0F0F0] animate-pulse" />
            <div className="h-8 w-3/4 rounded bg-[#F0F0F0] animate-pulse" />
            <div className="h-12 w-full rounded-full bg-[#F0F0F0] animate-pulse" />
            <div className="flex gap-3">
              <div className="h-10 flex-1 rounded-full bg-[#F0F0F0] animate-pulse" />
              <div className="h-10 flex-1 rounded-full bg-[#F0F0F0] animate-pulse" />
            </div>
            <div className="h-48 w-full rounded-2xl bg-[#F0F0F0] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Not found ---------- */

  if (!generation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white animate-fade-in-up">
        <div className="flex size-16 items-center justify-center rounded-full bg-[#F0F0F0]">
          <ImageIcon className="size-7 text-[#9CA3AF]" />
        </div>
        <p className="mt-4 text-[14px] text-[#6B7280]">Generation not found</p>
        <button
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] px-4 py-2 text-[14px] font-semibold text-[#6B7280] transition-colors hover:text-[#1A1A1A] hover:border-[#1A1A1A]"
          onClick={() => router.push("/dashboard/generations")}
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      </div>
    );
  }

  /* ---------- Derived values ---------- */

  const shortId = generation.id.slice(0, 4).toUpperCase();
  const isVideo = selectedAsset?.type === "video";
  const isImage = selectedAsset?.type === "image";
  const typeBadgeLabel = isVideo ? "VIDEO" : isImage ? "IMAGE" : (ASSET_TYPE_LABELS[selectedAsset?.type || ""] || "ASSET").toUpperCase();

  /* ---------- Main render ---------- */

  return (
    <div className="min-h-screen bg-white animate-fade-in-up">
      <div className="mx-auto max-w-7xl px-8 py-6">
        {/* ====== Back link + Scene Builder ====== */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard/generations")}
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#6B7280] transition-colors hover:text-[#1A1A1A]"
          >
            <ArrowLeft className="size-4" />
            Back to Generations
          </button>
          <button
            onClick={() => router.push(`/dashboard/scene-builder/${generationId}`)}
            className="inline-flex items-center gap-1.5 rounded-sm border border-neutral-200 bg-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
          >
            open in scene builder →
          </button>
        </div>

        {assets.length === 0 ? (
          /* ====== Empty state ====== */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#F0F0F0] bg-white py-20">
            <div className="flex size-14 items-center justify-center rounded-full bg-[#F0F0F0]">
              <ImageIcon className="size-7 text-[#9CA3AF]" />
            </div>
            <p className="mt-4 text-[14px] text-[#6B7280]">No assets generated yet</p>
          </div>
        ) : (
          /* ====== Two-column layout ====== */
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            {/* -------- LEFT COLUMN (60%) -------- */}
            <div className="lg:col-span-3 space-y-5">
              {/* Hero preview */}
              <div
                className="relative overflow-hidden rounded-2xl bg-[#F0F0F0] flex items-center justify-center"
                style={{
                  maxHeight: "calc(100vh - 14rem)",
                  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)",
                }}
              >
                {selectedAsset?.public_url ? (
                  <>
                    {/* ---- Image ---- */}
                    {selectedAsset.type === "image" && (
                      <img
                        src={selectedAsset.public_url}
                        alt={getAssetLabel(selectedAsset, assets.indexOf(selectedAsset))}
                        className="max-w-full max-h-full object-contain rounded-2xl"
                        style={{
                          maxHeight: "calc(100vh - 14rem)",
                          filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.06))",
                        }}
                      />
                    )}

                    {/* ---- Video (respects source aspect ratio) ---- */}
                    {selectedAsset.type === "video" && (() => {
                      const ar = selectedAsset.aspect_ratio || "16:9";
                      const aspectClass =
                        ar === "9:16"
                          ? "aspect-[9/16] max-h-[calc(100vh-14rem)] mx-auto"
                          : ar === "1:1"
                          ? "aspect-square max-h-[calc(100vh-14rem)] mx-auto"
                          : ar === "21:9"
                          ? "aspect-[21/9]"
                          : ar === "4:3"
                          ? "aspect-[4/3] max-h-[calc(100vh-14rem)] mx-auto"
                          : ar === "3:4"
                          ? "aspect-[3/4] max-h-[calc(100vh-14rem)] mx-auto"
                          : "aspect-video";
                      return (
                        <div className={cn("relative w-full bg-[#0A0A0A] rounded-2xl overflow-hidden", aspectClass)}>
                          <video
                            key={selectedAsset.id}
                            src={selectedAsset.public_url}
                            controls
                            playsInline
                            className="h-full w-full object-contain"
                          />
                          <span
                            className={cn(
                              "absolute bottom-3 start-3",
                              "inline-flex items-center rounded-full px-2.5 py-1",
                              "text-[10px] font-bold uppercase tracking-wider text-white",
                              "bg-white/10 backdrop-blur-md"
                            )}
                          >
                            HD PREVIEW · {ar}
                          </span>
                        </div>
                      );
                    })()}

                    {/* ---- Audio ---- */}
                    {selectedAsset.type === "audio" && (
                      <div className="flex flex-col items-center justify-center gap-6 py-16 px-6">
                        <div className="flex size-20 items-center justify-center rounded-full bg-[#4D5D4B]/10">
                          <Volume2 className="size-8 text-[#4D5D4B]" />
                        </div>
                        <audio
                          key={selectedAsset.id}
                          src={selectedAsset.public_url}
                          controls
                          className="w-full max-w-md"
                        />
                        {selectedAsset.metadata?.title && (
                          <p className="text-[14px] font-medium text-[#6B7280]">
                            {selectedAsset.metadata.title}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ---- Script ---- */}
                    {selectedAsset.type === "script" && (
                      <div className="p-6 w-full">
                        {selectedAsset.metadata?.title && (
                          <h3 className="mb-4 text-lg font-semibold text-[#1A1A1A]">
                            {selectedAsset.metadata.title}
                          </h3>
                        )}
                        <div className="max-h-[28rem] overflow-y-auto pe-2">
                          <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-[#6B7280]">
                            {selectedAsset.metadata?.full_script || ""}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* ---- Fallback ---- */}
                    {!["image", "video", "audio", "script"].includes(selectedAsset.type) && (
                      <img
                        src={selectedAsset.public_url}
                        alt={getAssetLabel(selectedAsset, assets.indexOf(selectedAsset))}
                        className="w-full rounded-2xl object-cover"
                      />
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-[#9CA3AF]">
                    <ImageIcon className="mb-3 size-10" />
                    <p className="text-[14px]">No preview available</p>
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {assets.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {assets.map((asset, index) => {
                    const isSelected = selectedAsset?.id === asset.id;
                    const label = getAssetLabel(asset, index);
                    return (
                      <button
                        key={asset.id}
                        onClick={() => setSelectedAsset(asset)}
                        className={cn(
                          "group relative shrink-0 overflow-hidden rounded-xl transition-all duration-200",
                          "h-16 w-16",
                          isSelected
                            ? "ring-2 ring-[#4D5D4B]"
                            : "border border-[#F0F0F0] hover:border-[#E5E7EB]"
                        )}
                      >
                        {(asset.type === "image" || asset.type === "thumbnail") && asset.public_url ? (
                          <img
                            src={asset.public_url}
                            alt={label}
                            className="size-full object-cover rounded-xl"
                            loading="lazy"
                          />
                        ) : asset.type === "video" && asset.public_url ? (
                          <div className="relative size-full bg-[#0A0A0A]">
                            <video
                              src={asset.public_url}
                              className="size-full object-cover rounded-xl"
                              muted
                              playsInline
                              preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                              <Play className="size-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex size-full flex-col items-center justify-center gap-0.5 bg-[#F0F0F0]">
                            {ASSET_TYPE_ICONS[asset.type] || <ImageIcon className="size-3.5 text-[#9CA3AF]" />}
                            <span className="text-[9px] font-medium text-[#9CA3AF] uppercase">
                              {asset.type === "audio" ? getAudioLabel(asset) : (ASSET_TYPE_LABELS[asset.type] || asset.type)}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* -------- RIGHT COLUMN (40%) -------- */}
            <div className="lg:col-span-2 space-y-5">
              {/* Type badge + ID row */}
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wider"
                  style={getTypeBadgeStyle(typeBadgeLabel)}
                >
                  {typeBadgeLabel}
                </span>
                <span className="font-mono text-[12px] text-[#9CA3AF]">
                  #TW-{shortId}
                </span>
              </div>

              {/* Title */}
              <h2 className="text-[24px] font-bold text-[#1A1A1A] leading-tight">
                {generation.title || generation.type.replace("_", " ")}
              </h2>

              {/* Description */}
              {selectedAsset?.creative_rationale && (
                <p className="text-[14px] leading-relaxed text-[#6B7280]">
                  {selectedAsset.creative_rationale}
                </p>
              )}

              {/* Ad copy metadata */}
              {selectedAsset?.metadata?.headline && (
                <div className="rounded-2xl border border-[#F0F0F0] p-5 space-y-2">
                  <p className="text-[14px] font-semibold text-[#1A1A1A]">
                    {selectedAsset.metadata.headline}
                  </p>
                  {selectedAsset.metadata.body && (
                    <p className="text-[14px] text-[#6B7280] leading-relaxed">
                      {selectedAsset.metadata.body}
                    </p>
                  )}
                  {selectedAsset.metadata.cta && (
                    <span className="inline-block mt-1 rounded-full border border-[#E5E7EB] px-2.5 py-0.5 text-[12px] font-medium text-[#1A1A1A]">
                      {selectedAsset.metadata.cta}
                    </span>
                  )}
                </div>
              )}

              {/* Download button */}
              <button
                className={cn(
                  "w-full h-12 rounded-full bg-[#4D5D4B] text-white text-[14px] font-semibold",
                  "inline-flex items-center justify-center gap-2",
                  "transition-colors hover:bg-[#3F4E3D]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                onClick={() => {
                  if (selectedAsset?.public_url) {
                    handleDownload(
                      selectedAsset.public_url,
                      selectedAsset,
                      assets.indexOf(selectedAsset) + 1
                    );
                  } else {
                    handleDownloadAll();
                  }
                }}
                disabled={assets.length === 0}
              >
                <Download className="size-4" />
                Download High-Res
              </button>

              {/* Share + Delete row */}
              <div className="flex items-center gap-3">
                <button
                  className="flex-1 h-10 rounded-full border border-[#E5E7EB] bg-white text-[14px] font-semibold text-[#1A1A1A] inline-flex items-center justify-center gap-2 transition-colors hover:bg-[#F0F0F0]"
                  onClick={() => {
                    if (navigator.share && selectedAsset?.public_url) {
                      navigator.share({ url: selectedAsset.public_url });
                    }
                  }}
                >
                  <Share2 className="size-4" />
                  Share
                </button>
                <button
                  className="flex-1 h-10 rounded-full border border-[#E5E7EB] bg-white text-[14px] font-semibold text-[#6B7280] inline-flex items-center justify-center gap-2 transition-colors hover:text-red-600 hover:border-red-200"
                  onClick={async () => {
                    if (!confirm("Are you sure you want to delete this generation? This cannot be undone.")) return;
                    try {
                      const res = await fetch(`/api/generations/${generationId}`, { method: "DELETE" });
                      if (res.ok) {
                        router.push("/dashboard/generations");
                      } else {
                        const data = await res.json();
                        alert(data.error || "Failed to delete generation");
                      }
                    } catch {
                      alert("Failed to delete generation");
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>

              {/* Technical details card */}
              <div className="rounded-2xl border border-[#F0F0F0] p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-4">
                  Technical Details
                </p>
                <div className="space-y-0">
                  {/* Credits Used */}
                  <div className="flex items-center justify-between py-3 border-b border-[#F0F0F0]">
                    <span className="text-[14px] text-[#6B7280]">Credits Used</span>
                    <span className="font-mono text-[14px] font-semibold text-[#1A1A1A]">
                      {generation.credits_used}
                    </span>
                  </div>
                  {/* Generation Time */}
                  <div className="flex items-center justify-between py-3 border-b border-[#F0F0F0]">
                    <span className="text-[14px] text-[#6B7280]">Generation Time</span>
                    <span className="font-mono text-[14px] font-semibold text-[#1A1A1A]">
                      {formatDuration(generation.created_at, generation.completed_at)}
                    </span>
                  </div>
                  {/* Resolution */}
                  <div className="flex items-center justify-between py-3 border-b border-[#F0F0F0]">
                    <span className="text-[14px] text-[#6B7280]">Resolution</span>
                    <span className="font-mono text-[14px] font-semibold text-[#1A1A1A]">
                      {getResolutionLabel(selectedAsset)}
                    </span>
                  </div>
                  {/* Model Engine */}
                  <div className="flex items-center justify-between py-3">
                    <span className="text-[14px] text-[#6B7280]">Model Engine</span>
                    <span className="font-mono text-[14px] font-semibold text-[#1A1A1A]">
                      {getModelEngine(generation.type)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Related assets section (horizontal scroll) */}
              {assets.length > 1 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">
                    Related Assets
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {assets
                      .filter((a) => a.id !== selectedAsset?.id)
                      .slice(0, 6)
                      .map((asset, index) => {
                        const label = getAssetLabel(asset, index);
                        return (
                          <button
                            key={asset.id}
                            onClick={() => setSelectedAsset(asset)}
                            className="shrink-0 h-16 w-16 rounded-xl overflow-hidden border border-[#F0F0F0] transition-all hover:border-[#E5E7EB]"
                          >
                            {(asset.type === "image" || asset.type === "thumbnail") && asset.public_url ? (
                              <img src={asset.public_url} alt={label} className="size-full object-cover" loading="lazy" />
                            ) : asset.type === "video" && asset.public_url ? (
                              <div className="relative size-full bg-[#0A0A0A]">
                                <video src={asset.public_url} className="size-full object-cover" muted playsInline preload="metadata" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                  <Play className="size-3.5 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div className="flex size-full items-center justify-center bg-[#F0F0F0]">
                                {ASSET_TYPE_ICONS[asset.type] || <ImageIcon className="size-3.5 text-[#9CA3AF]" />}
                              </div>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Original prompt card */}
              {generation.prompt && (
                <div className="rounded-2xl border border-[#F0F0F0] p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">
                    Original Prompt
                  </p>
                  <p className="text-[14px] italic leading-relaxed text-[#6B7280]">
                    {generation.prompt}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
