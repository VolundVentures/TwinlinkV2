"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Image,
  Video,
  FileText,
  Music,
  Download,
  FolderOpen,
  ExternalLink,
  Loader2,
  Play,
  Check,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";

type AssetType = "image" | "video" | "audio" | "script" | "thumbnail";

type Asset = {
  id: string;
  type: AssetType;
  public_url: string | null;
  thumbnail_url: string | null;
  variant_number: number;
  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
  };
};

type Generation = {
  id: string;
  title: string | null;
  type: string;
  status: string;
  created_at: string;
  generation_assets: Asset[];
};

type FilterTab = "all" | "image" | "video" | "script" | "audio";

type DateFilter = "24h" | "7d" | "30d" | "q3_2023";

// ---------- Sidebar config ----------

const ASSET_TYPE_ITEMS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All Assets" },
  { key: "image", label: "Images" },
  { key: "video", label: "Videos" },
  { key: "audio", label: "Audio" },
  { key: "script", label: "Scripts" },
];

const DATE_FILTER_ITEMS: { key: DateFilter; label: string }[] = [
  { key: "24h", label: "Last 24 Hours" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "q3_2023", label: "Q3 2023" },
];

// ---------- Helpers ----------

function getAssetIcon(type: AssetType, className = "h-4 w-4") {
  switch (type) {
    case "image":
    case "thumbnail":
      return <Image className={className} />;
    case "video":
      return <Video className={className} />;
    case "script":
      return <FileText className={className} />;
    case "audio":
      return <Music className={className} />;
    default:
      return <FileText className={className} />;
  }
}

function getAssetLabel(type: AssetType) {
  switch (type) {
    case "image":
    case "thumbnail":
      return "Image";
    case "video":
      return "Video";
    case "script":
      return "Script";
    case "audio":
      return "Audio";
    default:
      return String(type).charAt(0).toUpperCase() + String(type).slice(1);
  }
}

function getCategoryKey(type: AssetType): FilterTab {
  if (type === "thumbnail") return "image";
  return type as FilterTab;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function isWithinDateFilter(dateStr: string, filter: DateFilter): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  switch (filter) {
    case "24h":
      return now.getTime() - date.getTime() <= 24 * 60 * 60 * 1000;
    case "7d":
      return now.getTime() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return now.getTime() - date.getTime() <= 30 * 24 * 60 * 60 * 1000;
    case "q3_2023": {
      const y = date.getFullYear();
      const m = date.getMonth();
      return y === 2023 && m >= 6 && m <= 8;
    }
    default:
      return true;
  }
}

// ---------- Main component ----------

export default function LibraryPage() {
  const { t } = useTranslation();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [activeDateFilters, setActiveDateFilters] = useState<Set<DateFilter>>(
    new Set()
  );
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    async function fetchGenerations() {
      try {
        setLoading(true);
        const res = await fetch("/api/generations?limit=100");
        if (!res.ok) throw new Error("Failed to fetch generations");
        const data = await res.json();
        setGenerations(data.generations || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load assets");
      } finally {
        setLoading(false);
      }
    }
    fetchGenerations();
  }, []);

  // Flatten all assets with their parent generation info
  const allAssets = useMemo(() => {
    const items: {
      asset: Asset;
      generation: Generation;
    }[] = [];

    for (const gen of generations) {
      if (!gen.generation_assets) continue;
      for (const asset of gen.generation_assets) {
        items.push({ asset, generation: gen });
      }
    }

    return items;
  }, [generations]);

  // Counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: allAssets.length,
      image: 0,
      video: 0,
      script: 0,
      audio: 0,
    };
    for (const { asset } of allAssets) {
      const key = getCategoryKey(asset.type);
      if (key in counts) counts[key]++;
    }
    return counts;
  }, [allAssets]);

  // Filter by tab and date filters
  const filteredAssets = useMemo(() => {
    return allAssets.filter(({ asset, generation }) => {
      // Tab filter
      if (activeTab !== "all") {
        const assetType = asset.type === "thumbnail" ? "image" : asset.type;
        if (assetType !== activeTab) return false;
      }

      // Date filter
      if (activeDateFilters.size > 0) {
        const matchesAnyDate = Array.from(activeDateFilters).some((f) =>
          isWithinDateFilter(generation.created_at, f)
        );
        if (!matchesAnyDate) return false;
      }

      return true;
    });
  }, [allAssets, activeTab, activeDateFilters]);

  const visibleAssets = showAll ? filteredAssets : filteredAssets.slice(0, 12);

  function toggleDateFilter(filter: DateFilter) {
    setActiveDateFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  }

  function handleAssetClick(asset: Asset) {
    if (asset.public_url) {
      window.open(asset.public_url, "_blank");
    }
  }

  function handleDownload(e: React.MouseEvent, asset: Asset) {
    e.stopPropagation();
    if (asset.public_url) {
      const a = document.createElement("a");
      a.href = asset.public_url;
      a.download = "";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  // ---------- Loading state ----------

  if (loading) {
    return (
      <div className="px-8 py-6 space-y-6">
        <h1 className="text-[28px] font-bold text-[#1A1A1A]">Asset Library</h1>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#1A1A1A]" />
          <span className="ms-2 text-[14px] text-[#6B7280]">
            {t.common.loading}
          </span>
        </div>
      </div>
    );
  }

  // ---------- Error state ----------

  if (error) {
    return (
      <div className="px-8 py-6 space-y-6">
        <h1 className="text-[28px] font-bold text-[#1A1A1A]">Asset Library</h1>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#F0F0F0] bg-white py-16">
          <p className="text-[14px] font-medium text-[#1A1A1A]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-full bg-[#1A1A1A] px-5 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
          >
            {t.common.retry}
          </button>
        </div>
      </div>
    );
  }

  // Storage usage (simulated from asset count)
  const storageUsedGb = Math.min(
    14.2,
    parseFloat((allAssets.length * 0.15).toFixed(1)) || 14.2
  );
  const storageTotalGb = 20;
  const storagePercent = (storageUsedGb / storageTotalGb) * 100;

  // ---------- Render ----------

  return (
    <div className="px-8 py-6 space-y-6">
      {/* Header row */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-bold text-[#1A1A1A]">
              Asset Library
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              {allAssets.length} assets
            </p>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-8">
        {/* LEFT SIDEBAR */}
        <aside className="w-64 shrink-0 space-y-8">
          {/* ASSET TYPE — filter pills */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-4">
              Asset Type
            </p>
            <div className="flex flex-wrap gap-2">
              {ASSET_TYPE_ITEMS.map((item) => {
                const isActive = activeTab === item.key;
                const count = categoryCounts[item.key];
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all",
                      isActive
                        ? "bg-[#1A1A1A] text-white"
                        : "border border-[#E5E7EB] text-[#6B7280] hover:border-[#1A1A1A] hover:text-[#1A1A1A]"
                    )}
                  >
                    <span>{item.label}</span>
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        isActive ? "text-white/70" : "text-[#9CA3AF]"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* GENERATION DATE section */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-4">
              Generation Date
            </p>
            <ul className="space-y-2">
              {DATE_FILTER_ITEMS.map((item) => {
                const isChecked = activeDateFilters.has(item.key);
                return (
                  <li key={item.key}>
                    <button
                      onClick={() => toggleDateFilter(item.key)}
                      className="flex w-full items-center gap-2.5 text-left text-[13px] text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          isChecked
                            ? "border-[#1A1A1A] bg-[#1A1A1A]"
                            : "border-[#E5E7EB]"
                        )}
                      >
                        {isChecked && (
                          <Check className="h-2.5 w-2.5 text-white" />
                        )}
                      </span>
                      <span
                        className={cn(
                          "transition-colors",
                          isChecked ? "text-[#1A1A1A] font-medium" : "text-[#6B7280]"
                        )}
                      >
                        {item.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* TECHNICAL SPECS section */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-4">
              Technical Specs
            </p>
            <p className="text-[12px] font-medium text-[#6B7280] mb-2">
              Storage Usage
            </p>
            <div className="h-1.5 w-full rounded-full bg-[#F0F0F0]">
              <div
                className="h-full rounded-full bg-[#1A1A1A] transition-all"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] tabular-nums text-[#9CA3AF]">
              {storageUsedGb} GB / {storageTotalGb} GB
            </p>
          </div>
        </aside>

        {/* RIGHT — ASSET GRID */}
        <div className="flex-1 min-w-0">
          {filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#F0F0F0] bg-white py-20">
              <FolderOpen className="h-8 w-8 text-[#9CA3AF]" />
              <p className="mt-4 text-[14px] text-[#6B7280]">
                {activeTab !== "all"
                  ? "No matching assets"
                  : "Your asset library is empty"}
              </p>
              <p className="mt-1 max-w-sm text-center text-[13px] text-[#9CA3AF]">
                {activeTab !== "all"
                  ? "Try adjusting your filter to find what you're looking for."
                  : "All your generated assets will appear here."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {visibleAssets.map(({ asset, generation }) => {
                  const isVideo = asset.type === "video";
                  const isImage =
                    asset.type === "image" || asset.type === "thumbnail";
                  const duration = asset.metadata?.duration;

                  return (
                    <div
                      key={asset.id}
                      onClick={() => handleAssetClick(asset)}
                      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#F0F0F0] bg-white shadow-soft transition-all duration-200 hover:shadow-medium hover:-translate-y-0.5"
                    >
                      {/* Image assets */}
                      {isImage &&
                      (asset.thumbnail_url || asset.public_url) ? (
                        <div className="aspect-[3/4]">
                          <img
                            src={
                              asset.thumbnail_url || asset.public_url || ""
                            }
                            alt={generation.title || "Asset"}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : isVideo ? (
                        <div className="relative aspect-video bg-[#1A1A1A]">
                          {asset.thumbnail_url ? (
                            <img
                              src={asset.thumbnail_url}
                              alt={generation.title || "Video"}
                              className="h-full w-full object-cover"
                            />
                          ) : asset.public_url ? (
                            <video
                              src={asset.public_url}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <span className="text-[12px] font-bold text-white/30 uppercase tracking-wider">Video</span>
                            </div>
                          )}
                          {/* Play overlay — only on hover */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-lg">
                              <Play className="h-5 w-5 text-[#1A1A1A] ms-0.5" fill="currentColor" />
                            </div>
                          </div>
                          {/* Duration badge */}
                          {duration != null && (
                            <div className="absolute bottom-2 end-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white">
                              {formatDuration(duration)}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Script / Audio fallback */
                        <div className="flex aspect-[3/4] flex-col items-center justify-center gap-3 bg-[#F9FAFB]">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-soft">
                            {getAssetIcon(asset.type, "h-5 w-5 text-[#6B7280]")}
                          </div>
                          <span className="text-[12px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
                            {getAssetLabel(asset.type)}
                          </span>
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                        <p className="truncate text-[13px] font-medium text-white">
                          {generation.title || "Untitled"}
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[10px] tabular-nums text-white/70">
                            {formatDate(generation.created_at)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleDownload(e, asset)}
                              className="rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                              title={t.common.download}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (asset.public_url)
                                  window.open(asset.public_url, "_blank");
                              }}
                              className="rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                              title="Open"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SHOW MORE GENERATIONS divider */}
              {!showAll && filteredAssets.length > 12 && (
                <button
                  onClick={() => setShowAll(true)}
                  className="mt-6 flex w-full items-center gap-4"
                >
                  <span className="h-px flex-1 bg-[#E5E7EB]" />
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-[#9CA3AF] shrink-0 hover:text-[#6B7280] transition-colors">
                    Show More Generations
                  </span>
                  <span className="h-px flex-1 bg-[#E5E7EB]" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
