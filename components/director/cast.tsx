"use client";

// Cast — director gallery + dual-pick. Sits in the /dashboard/director
// flow as the first step before the brief.
//
// Aesthetic: editorial Monolith B&W to match the rest of the dashboard.
// Larger portrait tiles, generous gutters, sticky confirm bar.
// One header line at the top, one sticky action line at the bottom — the
// rest of the surface is cinema.

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CastDirector = {
  id: string;
  name: string;
  school: string;
  portraitUrl: string;
  visualSignature: string;
  filmsCited: { title: string; year?: number }[];
};

export type CastSelection = {
  leadDirectorId: string;
  coDirectorId: string | null;
};

export function Cast({
  onConfirm,
  initial,
}: {
  onConfirm: (s: CastSelection) => void;
  /** Pre-selected directors when resuming a film. */
  initial?: { leadDirectorId?: string; coDirectorId?: string };
}) {
  const [directors, setDirectors] = useState<CastDirector[] | null>(null);
  const [picked, setPicked] = useState<string[]>(() => {
    const out: string[] = [];
    if (initial?.leadDirectorId) out.push(initial.leadDirectorId);
    if (initial?.coDirectorId) out.push(initial.coDirectorId);
    return out;
  });
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/directors")
      .then((r) => r.json())
      .then((d) => setDirectors(d.directors))
      .catch((err) => console.error("Failed to load directors:", err));
  }, []);

  const grid = useMemo(() => directors ?? [], [directors]);

  const lead = picked[0];
  const co = picked[1];

  function togglePick(id: string) {
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 2) return [cur[0], id]; // co slot replaces, lead is sticky
      return [...cur, id];
    });
  }

  function clearPick(slot: 0 | 1) {
    setPicked((cur) => cur.filter((_, i) => i !== slot));
  }

  const ready = picked.length >= 1; // co is optional

  const focused = hover ? grid.find((d) => d.id === hover) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-10 pb-32 pt-2">
      {/* Header */}
      <div className="mb-10">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
          New film · cast
        </p>
        <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight text-neutral-900">
          Cast your directors.
        </h1>
        <p className="mt-4 max-w-xl font-serif text-[15px] leading-relaxed text-neutral-700">
          Pick a lead. Cast a co-director and they&apos;ll wait in the wings — switch the call to
          them anytime for a second school&apos;s perspective. Both travel with you through every
          room — pitch, world, storyboard, shoot, cut. They teach cinema as they direct.
        </p>
      </div>

      {/* Selected slots */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <SlotPill
          label="Lead"
          director={lead ? grid.find((d) => d.id === lead) : null}
          onClear={lead ? () => clearPick(0) : undefined}
        />
        <SlotPill
          label="Co-director"
          director={co ? grid.find((d) => d.id === co) : null}
          onClear={co ? () => clearPick(1) : undefined}
          optional
        />
      </div>

      {/* Grid */}
      {!directors && (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        </div>
      )}
      {directors && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
          {grid.map((d) => {
            const role = lead === d.id ? "Lead" : co === d.id ? "Co" : null;
            const selected = !!role;
            return (
              <button
                key={d.id}
                onClick={() => togglePick(d.id)}
                onMouseEnter={() => setHover(d.id)}
                onMouseLeave={() => setHover((h) => (h === d.id ? null : h))}
                className={cn(
                  "group relative flex flex-col text-left transition",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
                )}
                aria-pressed={selected}
              >
                <div
                  className={cn(
                    "relative aspect-[3/4] w-full overflow-hidden bg-neutral-100 transition-all",
                    selected
                      ? "ring-2 ring-neutral-900 ring-offset-2"
                      : "ring-1 ring-neutral-200 group-hover:ring-neutral-500"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.portraitUrl}
                    alt={d.name}
                    className={cn(
                      "h-full w-full object-cover grayscale transition-all duration-500",
                      selected ? "grayscale-0" : "group-hover:grayscale-[60%]"
                    )}
                    loading="lazy"
                  />
                  {role && (
                    <span className="absolute left-2 top-2 bg-neutral-900 px-2 py-1 font-mono text-[12px] uppercase tracking-[0.18em] text-white">
                      {role}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <p className="font-serif text-[18px] leading-tight tracking-tight text-neutral-900">
                    {d.name}
                  </p>
                  <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                    {d.school}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Hover detail strip — hidden until hover */}
      {focused && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-30 w-full max-w-3xl -translate-x-1/2 px-4">
          <div className="border border-neutral-900 bg-white px-5 py-4 shadow-xl">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              {focused.school}
            </p>
            <p className="mt-1 font-serif text-[15px] leading-snug text-neutral-900">
              {focused.visualSignature}
            </p>
            {focused.filmsCited.length > 0 && (
              <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
                {focused.filmsCited.slice(0, 4).map((f) => f.title).join(" · ")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sticky confirm bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-10 py-4">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            {!lead && "Pick a lead director."}
            {lead && !co && "Add a co-director — or proceed alone."}
            {lead && co && "Lead and co-director cast."}
          </p>
          <button
            disabled={!ready}
            onClick={() =>
              ready &&
              onConfirm({
                leadDirectorId: lead,
                coDirectorId: co || null,
              })
            }
            className={cn(
              "h-11 border px-6 font-mono text-[12px] uppercase tracking-[0.2em] transition",
              ready
                ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800"
                : "cursor-not-allowed border-neutral-300 text-neutral-400"
            )}
          >
            Continue to brief →
          </button>
        </div>
      </div>
    </div>
  );
}

function SlotPill({
  label,
  director,
  onClear,
  optional,
}: {
  label: string;
  director: CastDirector | null | undefined;
  onClear?: () => void;
  optional?: boolean;
}) {
  if (director) {
    return (
      <div className="flex items-center gap-3 border border-neutral-900 bg-white px-3 py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={director.portraitUrl}
          alt={director.name}
          className="h-12 w-12 shrink-0 object-cover grayscale-0"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            {label}
          </p>
          <p className="truncate font-serif text-[14px] leading-tight text-neutral-900">
            {director.name}
          </p>
          <p className="truncate font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
            {director.school}
          </p>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900"
          >
            clear
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 border border-dashed border-neutral-300 bg-neutral-50/50 px-3 py-2.5">
      <div className="h-12 w-12 shrink-0 bg-neutral-100" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
          {label}
          {optional && " · optional"}
        </p>
        <p className="font-serif text-[14px] italic leading-tight text-neutral-400">
          {optional ? "Cast someone for the wings (optional)" : "Pick from the gallery"}
        </p>
      </div>
    </div>
  );
}
