"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ImageIcon, Play } from "lucide-react";

type GenerationListItem = {
  id: string;
  title: string | null;
  type: string;
  status: string;
  created_at: string;
  generation_assets?: Array<{
    public_url: string | null;
    thumbnail_url: string | null;
    type: string;
  }>;
};

function pickThumb(g: GenerationListItem): string | null {
  const assets = g.generation_assets || [];
  const withThumb = assets.find((a) => a.thumbnail_url);
  if (withThumb?.thumbnail_url) return withThumb.thumbnail_url;
  const img = assets.find((a) => a.type === "image" && a.public_url);
  if (img?.public_url) return img.public_url;
  const vid = assets.find((a) => a.type === "video" && a.public_url);
  return vid?.public_url ?? null;
}

export default function SceneBuilderIndexPage() {
  const [items, setItems] = useState<GenerationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/generations");
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as {
          generations?: GenerationListItem[];
        };
        if (!cancelled) setItems(data.generations || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1000px] px-8 py-10">
      <div className="border-b border-neutral-200 pb-6">
        <h1 className="font-serif text-[28px] tracking-tight text-neutral-900">
          Scene Builder
        </h1>
        <p className="mt-2 max-w-[600px] text-[13px] leading-relaxed text-neutral-600">
          Inspect how each shot is composed — plates, edits, keyframes, shot
          videos — as a single chain. Open any asset to see its lineage or
          request a refinement. Choose a generation to open.
        </p>
      </div>

      {loading && (
        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-400">
          Loading…
        </p>
      )}

      {error && (
        <p className="mt-10 text-[13px] text-neutral-700">
          Couldn&apos;t load generations: {error}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="mt-10 text-[13px] text-neutral-600">
          No generations yet. Create one in the{" "}
          <Link
            href="/dashboard/director"
            className="underline hover:text-neutral-900"
          >
            Director
          </Link>
          .
        </p>
      )}

      <ul className="mt-6 divide-y divide-neutral-200">
        {items.map((g) => (
          <li key={g.id}>
            <Link
              href={`/dashboard/scene-builder/${g.id}`}
              className="flex items-center gap-4 py-4 transition-colors hover:bg-neutral-50"
            >
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-sm border border-neutral-200 bg-neutral-100">
                {pickThumb(g) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pickThumb(g)!}
                    alt={g.title || g.id}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-neutral-400">
                    {g.type === "video" ? (
                      <Play className="h-4 w-4" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-[15px] tracking-tight text-neutral-900">
                  {g.title || "Untitled"}
                </div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                  {g.type} · {g.status} ·{" "}
                  {new Date(g.created_at).toLocaleDateString()}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
