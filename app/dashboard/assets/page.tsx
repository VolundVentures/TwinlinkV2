"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Image as ImageIcon,
  Film,
  Music,
  Search,
  Trash2,
  Download,
  Plus,
  Loader2,
  X,
  Grid3X3,
  LayoutList,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Asset = {
  id: string;
  name: string;
  type: string;
  url: string;
  file_size?: number;
  mime_type?: string;
  source: string;
  created_at: string;
  aspect_ratio?: string;
  generation_id?: string;
  metadata?: Record<string, unknown>;
};

type FilterType = "all" | "image" | "video" | "audio";

const TYPE_ICONS: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function relativeTime(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [dragOver, setDragOver] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.ok ? r.json() : { assets: [] })
      .then((d) => setAssets(d.assets || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleUpload(files: FileList | File[]) {
    setUploading(true);
    const fileArr = Array.from(files);

    for (const file of fileArr) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name);
      formData.append("source", "upload");

      try {
        const res = await fetch("/api/assets", { method: "POST", body: formData });
        if (res.ok) {
          const { asset } = await res.json();
          if (asset) setAssets((prev) => [asset, ...prev]);
        }
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
  }

  async function handleDelete(assetId: string) {
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE" });
      if (res.ok) setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch {}
  }

  const filtered = assets.filter((a) => {
    if (filter !== "all" && a.type !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: assets.length,
    image: assets.filter((a) => a.type === "image").length,
    video: assets.filter((a) => a.type === "video").length,
    audio: assets.filter((a) => a.type === "audio").length,
  };

  return (
    <div
      className="px-4 sm:px-6 md:px-8 py-6 space-y-6 min-h-full"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {dragOver && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#4D5D4B]/10 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="bg-white rounded-2xl border-2 border-dashed border-[#4D5D4B] p-12 text-center shadow-xl">
              <Upload className="h-12 w-12 text-[#4D5D4B] mx-auto mb-4" />
              <p className="text-[18px] font-bold text-[#1A1A1A]">Drop files to upload</p>
              <p className="text-[14px] text-[#9CA3AF] mt-1">Images, videos, or audio files</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#1A1A1A]">Assets</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">{assets.length} asset{assets.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-full bg-[#1A1A1A] text-white px-5 py-2.5 text-[14px] font-semibold hover:bg-[#333] transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Upload
          </button>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["all", "image", "video", "audio"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-full text-[13px] font-semibold transition-all flex items-center gap-1.5",
                filter === f ? "bg-[#1A1A1A] text-white" : "text-[#6B7280] hover:bg-[#F3F4F6]"
              )}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={cn("text-[11px]", filter === f ? "text-white/50" : "text-[#D1D5DB]")}>{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-3 h-9">
            <Search className="h-3.5 w-3.5 text-[#9CA3AF]" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-[13px] text-[#1A1A1A] outline-none w-40 placeholder:text-[#C4C4C4]"
            />
          </div>
          <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden">
            <button onClick={() => setView("grid")} className={cn("p-1.5", view === "grid" ? "bg-[#F3F4F6]" : "hover:bg-[#F9FAFB]")}>
              <Grid3X3 className="h-4 w-4 text-[#6B7280]" />
            </button>
            <button onClick={() => setView("list")} className={cn("p-1.5", view === "list" ? "bg-[#F3F4F6]" : "hover:bg-[#F9FAFB]")}>
              <LayoutList className="h-4 w-4 text-[#6B7280]" />
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewAsset && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
            onClick={() => setPreviewAsset(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[85vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewAsset(null)}
                className="absolute -top-10 right-0 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 z-10"
              >
                <X className="h-4 w-4" />
              </button>
              {previewAsset.type === "image" ? (
                <img src={previewAsset.url} alt={previewAsset.name} className="w-full max-h-[80vh] object-contain rounded-xl" />
              ) : previewAsset.type === "video" ? (
                <video src={previewAsset.url} controls autoPlay className="w-full max-h-[80vh] rounded-xl" />
              ) : previewAsset.type === "audio" ? (
                <div className="bg-white rounded-xl p-8 text-center">
                  <Music className="h-12 w-12 text-[#9CA3AF] mx-auto mb-4" />
                  <p className="text-[16px] font-bold text-[#1A1A1A] mb-4">{previewAsset.name}</p>
                  <audio src={previewAsset.url} controls autoPlay className="w-full" />
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[13px] text-white/70">{previewAsset.name}</p>
                <a
                  href={`/api/download?url=${encodeURIComponent(previewAsset.url)}`}
                  className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] text-white hover:bg-white/20"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#9CA3AF]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mb-4">
            <Upload className="h-7 w-7 text-[#9CA3AF]" />
          </div>
          <h3 className="text-[18px] font-bold text-[#1A1A1A]">
            {assets.length === 0 ? "No assets yet" : "No matches"}
          </h3>
          <p className="text-[14px] text-[#9CA3AF] mt-1 max-w-xs">
            {assets.length === 0
              ? "Upload files or generate content — all your images, videos, and audio will appear here."
              : "Try a different search or filter."}
          </p>
          {assets.length === 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 flex items-center gap-2 rounded-full bg-[#1A1A1A] text-white px-6 py-2.5 text-[14px] font-semibold hover:bg-[#333]"
            >
              <Upload className="h-4 w-4" /> Upload files
            </button>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((asset) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setPreviewAsset(asset)}
              className="group rounded-xl border border-[#F0F0F0] bg-white overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <div className="aspect-square relative bg-[#F9FAFB]">
                {asset.type === "image" ? (
                  <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                ) : asset.type === "video" ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <video src={asset.url} className="w-full h-full object-cover" muted />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-white/80 flex items-center justify-center shadow">
                        <Play className="h-4 w-4 text-[#1A1A1A] ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="h-8 w-8 text-[#D1D5DB]" />
                  </div>
                )}
                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-start justify-end p-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }}
                    className="h-7 w-7 rounded-lg bg-white/90 flex items-center justify-center text-[#EF4444] hover:bg-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[12px] font-medium text-[#1A1A1A] truncate">{asset.name}</p>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                  {asset.source === "generation" || asset.source === "generated" ? "Generated" : asset.file_size ? formatBytes(asset.file_size) : "Uploaded"} &middot; {relativeTime(asset.created_at)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((asset) => {
            const Icon = TYPE_ICONS[asset.type] || ImageIcon;
            return (
              <div key={asset.id} onClick={() => setPreviewAsset(asset)} className="flex items-center gap-4 rounded-xl border border-[#F0F0F0] bg-white px-4 py-3 hover:border-[#E5E7EB] hover:shadow-sm transition-all group cursor-pointer">
                <div className="h-10 w-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
                  {asset.type === "image" ? (
                    <img src={asset.url} alt="" className="h-full w-full rounded-lg object-cover" />
                  ) : (
                    <Icon className="h-5 w-5 text-[#9CA3AF]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1A1A1A] truncate">{asset.name}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{asset.type} &middot; {asset.source === "generation" || asset.source === "generated" ? "Generated" : asset.file_size ? formatBytes(asset.file_size) : "Uploaded"} &middot; {relativeTime(asset.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={asset.url} download className="h-8 w-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#1A1A1A] hover:bg-[#F3F4F6]">
                    <Download className="h-4 w-4" />
                  </a>
                  <button onClick={() => handleDelete(asset.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEF2F2]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
