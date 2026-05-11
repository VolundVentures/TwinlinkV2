"use client";

// Whiteboard — the teaching surface.
//
// The directors invoke a `show_visual_example` tool during conversation to
// conjure a reference image (a camera angle, a lighting setup, a frame from
// a fictional film, etc). The image lands here as a card with a caption.
//
// Cards are rendered in a horizontal scrollable strip — newest on the left.
// Click a card to expand it as a modal.

import { useState } from "react";

export type WhiteboardCard = {
  id: string;
  url: string;
  caption: string;
  /** Persona that conjured it, e.g. "Yuki Sato". */
  directorName: string;
  /** Persona id, used to look up portrait for the badge. */
  directorId: string;
  createdAt: number;
};

export function Whiteboard({
  cards,
  loading,
}: {
  cards: WhiteboardCard[];
  /** True while a card is in flight (image generating). */
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState<WhiteboardCard | null>(null);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-t border-neutral-200 bg-neutral-50">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
        <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-neutral-500">
          The Whiteboard
        </p>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
          {cards.length} {cards.length === 1 ? "reference" : "references"}
          {loading && " · drawing…"}
        </p>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {cards.length === 0 && !loading && (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="max-w-md font-serif text-sm italic leading-relaxed text-neutral-500">
              The directors will sketch references here as you talk. Ask them to
              show you an angle, a lens, a lighting setup — they&apos;ll draw it
              live.
            </p>
          </div>
        )}

        <div className="flex h-full gap-3 p-3">
          {loading && (
            <div className="flex aspect-video h-full max-h-[260px] shrink-0 animate-pulse items-center justify-center bg-neutral-200">
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                Drawing…
              </p>
            </div>
          )}
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => setExpanded(card)}
              className="group flex aspect-video h-full max-h-[260px] shrink-0 flex-col overflow-hidden bg-white text-left ring-1 ring-neutral-200 transition hover:ring-neutral-900"
              style={{ width: "fit-content" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.url}
                alt={card.caption}
                className="block h-[70%] w-auto max-w-full object-cover"
                style={{ aspectRatio: "16 / 9" }}
                loading="lazy"
              />
              <div className="flex flex-col gap-0.5 px-3 py-2">
                <p className="font-serif text-xs leading-snug text-neutral-900 line-clamp-2">
                  {card.caption}
                </p>
                <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
                  via {card.directorName}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-8"
          onClick={() => setExpanded(null)}
        >
          <div
            className="flex w-full max-w-5xl flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={expanded.url}
              alt={expanded.caption}
              className="w-full"
            />
            <div className="flex items-center justify-between text-white">
              <p className="font-serif text-base">{expanded.caption}</p>
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
                via {expanded.directorName}
              </p>
            </div>
            <button
              onClick={() => setExpanded(null)}
              className="self-end font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400 hover:text-white"
            >
              ✕ close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
