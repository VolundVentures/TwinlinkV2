"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RecentGen = {
  id: string;
  title: string | null;
  type: string;
  status: string;
  created_at: string;
  generation_assets: Array<{ type: string; public_url: string | null; thumbnail_url: string | null }>;
};

function getThumb(gen: RecentGen): string | null {
  const img = gen.generation_assets.find(
    (a) => (a.type === "image" || a.type === "thumbnail") && a.public_url
  );
  return img?.thumbnail_url || img?.public_url || null;
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

export default function DashboardPage() {
  const [recent, setRecent] = useState<RecentGen[]>([]);

  useEffect(() => {
    fetch("/api/generations?limit=12")
      .then((r) => (r.ok ? r.json() : { generations: [] }))
      .then((d) => setRecent(d.generations || []))
      .catch(() => setRecent([]));
  }, []);

  const recentWithThumbs = recent.filter((g) => getThumb(g));

  return (
    <div className="mx-auto w-full max-w-5xl px-10 py-14 space-y-14">
      {/* Hero */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          TwinLink · Director
        </p>
        <h1 className="mt-4 font-serif text-6xl leading-[1.02] tracking-tight text-neutral-900">
          Direct cinematic
          <br />
          commercials with AI.
        </h1>
        <p className="mt-6 max-w-xl font-serif text-[17px] leading-relaxed text-neutral-700">
          From brief to final cut — plates, keyframes, shots, grade, score. Cannes-tier films
          generated through a 5-stage approval pipeline.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/director"
            className="inline-flex h-12 items-center rounded-none bg-neutral-900 px-6 text-[11px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
          >
            Start a film →
          </Link>
          <Link
            href="/dashboard/generations"
            className="inline-flex h-12 items-center border border-neutral-300 px-6 text-[11px] uppercase tracking-[0.18em] text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
          >
            Browse gallery
          </Link>
        </div>
      </section>

      {/* Pipeline cheatsheet */}
      <section className="border-t border-neutral-200 pt-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          The pipeline
        </p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
          {[
            { n: "01", label: "Treatment", hint: "Concept + end card + world" },
            { n: "02", label: "Plates", hint: "Characters · locations · props" },
            { n: "03", label: "Keyframes", hint: "One still per shot" },
            { n: "04", label: "Shots", hint: "Kling Omni animates the still" },
            { n: "05", label: "Cut", hint: "Compose · score · ship" },
          ].map((s) => (
            <div key={s.n} className="border-t border-neutral-900 pt-3">
              <p className="font-mono text-[11px] tabular-nums text-neutral-500">{s.n}</p>
              <p className="mt-1 font-serif text-lg text-neutral-900">{s.label}</p>
              <p className="mt-1 text-[12px] text-neutral-500">{s.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent films */}
      {recentWithThumbs.length > 0 && (
        <section className="border-t border-neutral-200 pt-10">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Recent
            </p>
            <Link
              href="/dashboard/generations"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500 hover:text-neutral-900"
            >
              All →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-5">
            {recentWithThumbs.slice(0, 8).map((gen) => {
              const thumb = getThumb(gen)!;
              return (
                <Link
                  key={gen.id}
                  href={`/dashboard/generations/${gen.id}`}
                  className="group block"
                >
                  <div className="aspect-video overflow-hidden border border-neutral-200 bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt={gen.title || gen.type}
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  </div>
                  <p className="mt-2 truncate font-serif text-[13px] text-neutral-900">
                    {gen.title || gen.type.replace(/_/g, " ")}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                    {relativeTime(gen.created_at)}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
