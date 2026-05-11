"use client";

// AUTEUR Lobby — the 20-portrait gallery.
//
// User picks two director personas (lead first, then co-director). On confirm,
// the parent flow opens a Characters API session for both and routes into the
// shell with the avatar panel + chat + workspace panes.
//
// Aesthetic: Monolith B&W editorial. Serif headers, mono labels, no color.

import { useEffect, useMemo, useState } from "react";

type LobbyDirector = {
  id: string;
  name: string;
  school: string;
  portraitUrl: string;
  filmsCited: { title: string; year: number }[];
};

export type LobbySelection = {
  leadDirectorId: string;
  coDirectorId: string;
};

export function Lobby({ onConfirm }: { onConfirm: (s: LobbySelection) => void }) {
  const [directors, setDirectors] = useState<LobbyDirector[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]); // [lead, co]

  useEffect(() => {
    fetch("/api/directors")
      .then((r) => r.json())
      .then((d) => setDirectors(d.directors))
      .catch((err) => console.error("Failed to load directors:", err));
  }, []);

  const grid = useMemo(() => directors ?? [], [directors]);

  function togglePick(id: string) {
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 2) return [cur[1], id]; // FIFO at cap of 2
      return [...cur, id];
    });
  }

  const ready = picked.length === 2;

  return (
    <div className="min-h-screen w-full bg-white text-neutral-900">
      {/* Header */}
      <header className="border-b border-neutral-200 px-8 py-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">AUTEUR</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight">
          Cast your directors.
        </h1>
        <p className="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-neutral-600">
          Pick two. They&apos;ll travel with you through the entire production — pitch, pre-production,
          shooting, post, review. Each is a fictional persona trained on a body of cinema. They will
          teach you film history while making your film.
        </p>
      </header>

      {/* Grid */}
      <main className="px-8 py-8">
        {!directors && (
          <p className="font-mono text-sm text-neutral-500">Loading directors…</p>
        )}
        {directors && (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {grid.map((d) => {
              const role = picked[0] === d.id ? "Lead" : picked[1] === d.id ? "Co-director" : null;
              const selected = picked.includes(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => togglePick(d.id)}
                  className={[
                    "group relative flex flex-col text-left transition",
                    selected ? "" : "hover:opacity-90",
                  ].join(" ")}
                  aria-pressed={selected}
                >
                  <div
                    className={[
                      "relative aspect-square w-full overflow-hidden border bg-neutral-100",
                      selected ? "border-neutral-900 ring-2 ring-neutral-900" : "border-neutral-200",
                    ].join(" ")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.portraitUrl}
                      alt={d.name}
                      className="h-full w-full object-cover grayscale"
                      loading="lazy"
                    />
                    {role && (
                      <span className="absolute left-2 top-2 bg-neutral-900 px-2 py-1 font-mono text-[12px] uppercase tracking-[0.18em] text-white">
                        {role}
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="font-serif text-base leading-tight">{d.name}</p>
                    <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                      {d.school}
                    </p>
                    <p className="mt-2 font-mono text-[11px] leading-snug text-neutral-600 line-clamp-2">
                      {d.filmsCited.slice(0, 3).map((f) => f.title).join(" · ")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Sticky confirm bar */}
      <div className="sticky bottom-0 border-t border-neutral-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-wider text-neutral-500">
            {picked.length === 0 && "Pick the lead director first."}
            {picked.length === 1 && "Pick the co-director."}
            {picked.length === 2 &&
              `Lead: ${grid.find((d) => d.id === picked[0])?.name} — Co: ${grid.find((d) => d.id === picked[1])?.name}`}
          </p>
          <button
            disabled={!ready}
            onClick={() => ready && onConfirm({ leadDirectorId: picked[0], coDirectorId: picked[1] })}
            className={[
              "border px-6 py-3 font-mono text-xs uppercase tracking-wider transition",
              ready
                ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700"
                : "cursor-not-allowed border-neutral-300 text-neutral-400",
            ].join(" ")}
          >
            Begin development →
          </button>
        </div>
      </div>
    </div>
  );
}
