"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RecentFilm = {
  id: string;
  title: string | null;
  type: string;
  status: string;
  created_at: string;
  generation_assets: Array<{ type: string; public_url: string | null }>;
};

function relativeTime(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function pickThumb(film: RecentFilm): string | null {
  const images = film.generation_assets.filter(
    (a) => (a.type === "image" || a.type === "thumbnail") && a.public_url
  );
  if (images.length > 0) return images[0].public_url;
  const video = film.generation_assets.find((a) => a.type === "video" && a.public_url);
  return video?.public_url || null;
}

/**
 * Compact "Recent films" strip shown on the director landing so the user can
 * continue a film in one click. Sits above the brief form.
 */
export function RecentFilms({ limit = 6 }: { limit?: number }) {
  const [films, setFilms] = useState<RecentFilm[] | null>(null);

  useEffect(() => {
    fetch(`/api/generations?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : { generations: [] }))
      .then((d) => setFilms(d.generations || []))
      .catch(() => setFilms([]));
  }, [limit]);

  if (films === null || films.length === 0) return null;

  return (
    <section className="border-b border-neutral-200 pb-10">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
          Continue a film
        </p>
        <Link
          href="/dashboard/generations"
          className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900"
        >
          All →
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {films.slice(0, limit).map((f) => {
          const thumb = pickThumb(f);
          return (
            <Link
              key={f.id}
              href={`/dashboard/director?resume=${f.id}`}
              className="group block"
            >
              <div className="aspect-video overflow-hidden border border-neutral-200 bg-neutral-100">
                {thumb ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumb}
                    alt={f.title || "film"}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
                      In progress
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-2 truncate font-serif text-[12px] leading-tight text-neutral-900">
                {f.title || "Untitled film"}
              </p>
              <p className="mt-0.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                {relativeTime(f.created_at)}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
