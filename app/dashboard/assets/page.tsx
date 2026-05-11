"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "video", label: "Videos" },
  { key: "audio", label: "Audio" },
];

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => (r.ok ? r.json() : { assets: [] }))
      .then((d) => setAssets(d.assets || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleUpload(files: FileList | File[]) {
    setUploading(true);
    for (const file of Array.from(files)) {
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

  useEffect(() => {
    if (!previewAsset) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewAsset(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewAsset]);

  const counts = useMemo(
    () => ({
      all: assets.length,
      image: assets.filter((a) => a.type === "image").length,
      video: assets.filter((a) => a.type === "video").length,
      audio: assets.filter((a) => a.type === "audio").length,
    }),
    [assets]
  );

  const filtered = useMemo(
    () =>
      assets.filter((a) => {
        if (filter !== "all" && a.type !== filter) return false;
        if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [assets, filter, search]
  );

  return (
    <div
      className="mx-auto w-full max-w-6xl px-10 py-14 space-y-10"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/85">
          <div className="border border-white/30 bg-black px-10 py-8 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">
              Drop to upload
            </p>
            <p className="mt-3 font-serif text-2xl text-white">
              Images, videos, or audio.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          TwinLink &middot; Assets
        </p>
        <div className="mt-4 flex items-end justify-between gap-6">
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-neutral-900">
            Every asset.
            <br />
            Every reference.
          </h1>
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
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-11 items-center rounded-none bg-neutral-900 px-5 font-mono text-[10px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload →"}
            </button>
          </div>
        </div>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          {assets.length} asset{assets.length !== 1 ? "s" : ""}
        </p>
      </section>

      {/* Filters + search */}
      <section className="border-t border-neutral-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-6">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
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
                    {counts[f.key]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 border-b border-neutral-200 pb-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name…"
              className="h-7 w-44 border-none bg-transparent font-serif text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
            />
          </div>
        </div>
      </section>

      {/* Preview Modal */}
      {previewAsset && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewAsset(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-8"
        >
          <button
            type="button"
            onClick={() => setPreviewAsset(null)}
            aria-label="Close"
            className="absolute right-6 top-6 h-10 w-10 border border-white/20 bg-white/10 font-mono text-[12px] text-white hover:bg-white/20"
          >
            ×
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-5xl flex-col gap-5"
          >
            <div className="flex flex-1 items-center justify-center overflow-hidden">
              {previewAsset.type === "image" ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewAsset.url}
                  alt={previewAsset.name}
                  className="max-h-[80vh] max-w-full object-contain"
                />
              ) : previewAsset.type === "video" ? (
                <video
                  src={previewAsset.url}
                  controls
                  autoPlay
                  className="max-h-[80vh] max-w-full"
                />
              ) : (
                <div className="border border-white/15 bg-black px-12 py-10 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">
                    Audio
                  </p>
                  <p className="mt-2 font-serif text-[16px] text-white">
                    {previewAsset.name}
                  </p>
                  <audio src={previewAsset.url} controls autoPlay className="mt-6 w-full" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-white/15 pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">
                {previewAsset.name}
              </p>
              <a
                href={`/api/download?url=${encodeURIComponent(previewAsset.url)}`}
                className="inline-flex h-9 items-center border border-white/25 px-4 font-mono text-[10px] uppercase tracking-[0.18em] text-white/80 hover:border-white hover:text-white"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <section className="py-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Loading
          </p>
        </section>
      ) : filtered.length === 0 ? (
        <section className="border-t border-neutral-200 py-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            {assets.length === 0 ? "Empty asset library" : "No matches"}
          </p>
          <h3 className="mt-4 font-serif text-3xl leading-tight text-neutral-900">
            {assets.length === 0 ? "Upload or generate." : "Nothing here."}
          </h3>
          {assets.length === 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-8 inline-flex h-11 items-center rounded-none bg-neutral-900 px-5 font-mono text-[10px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
            >
              Upload files →
            </button>
          )}
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              className="group cursor-pointer"
              onClick={() => setPreviewAsset(asset)}
            >
              <div className="relative aspect-square overflow-hidden border border-neutral-200 bg-neutral-100 transition-colors group-hover:border-neutral-900">
                {asset.type === "image" ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={asset.url}
                    alt={asset.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                ) : asset.type === "video" ? (
                  <>
                    <video
                      src={asset.url}
                      muted
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="border border-white/60 bg-black/40 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-white">
                        Video
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-400">
                      Audio
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(asset.id);
                  }}
                  className="absolute right-2 top-2 hidden h-7 border border-white/80 bg-black/60 px-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white group-hover:inline-flex group-hover:items-center hover:bg-black/80"
                >
                  Delete
                </button>
              </div>
              <p className="mt-3 truncate font-serif text-[13px] text-neutral-900">
                {asset.name}
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                {asset.source === "generation" || asset.source === "generated"
                  ? "Generated"
                  : asset.file_size
                    ? formatBytes(asset.file_size)
                    : "Uploaded"}
                {" · "}
                {relativeTime(asset.created_at)}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
