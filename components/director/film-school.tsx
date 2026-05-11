"use client";

// Film School — gamified teaching surface.
//
// AUTEUR (May 2026): every time a director cites a real film + technique via
// the `cite_lesson` tool, a card lands here. The user collects lessons across
// the production. The final dossier exports `lesson_plan.md` with the full
// set.
//
// UI: right-edge slide-over. Cards grouped by director. Each card shows
// portrait + film + year + technique + the director's quote. Empty state
// invites the user to ask the directors questions.

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonCard, ReferenceCard } from "./use-director";
import type { CastedDirector } from "./director-types";

// Match the dedup key used by /api/whiteboard/generate so a lesson card
// can be paired with its auto-rendered textbook reference image.
function normalizeKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function FilmSchoolButton({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.18em] transition",
        count > 0
          ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800"
          : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900"
      )}
      title="Open Film School"
    >
      <BookOpen className="h-3 w-3" />
      Film School
      {count > 0 && (
        <span className="ml-1 font-mono tabular-nums">{count}</span>
      )}
    </button>
  );
}

export function FilmSchoolPanel({
  open,
  onClose,
  lessons,
  references,
  cast,
}: {
  open: boolean;
  onClose: () => void;
  lessons: LessonCard[];
  references: ReferenceCard[];
  cast: { lead: CastedDirector | null; co: CastedDirector | null };
}) {
  // Index references by (director_id, technique_key) so each lesson card
  // can render its matching textbook page inline. The whiteboard endpoint
  // computes technique_key the same way; the lesson card uses the raw
  // technique string and we re-normalize.
  const refByKey = useMemo(() => {
    const m = new Map<string, ReferenceCard>();
    for (const r of references) {
      const captionKey = normalizeKey(r.caption);
      m.set(`${r.director_id}::${captionKey}`, r);
    }
    return m;
  }, [references]);
  const findRef = (lesson: LessonCard): ReferenceCard | undefined => {
    // Whiteboard's technique_key falls back to caption when technique is
    // missing; lessons always carry technique. Try technique first, then
    // why (which we use as caption when generating).
    const techKey = normalizeKey(lesson.technique);
    const whyKey = normalizeKey(lesson.why);
    return (
      refByKey.get(`${lesson.director_id}::${techKey}`) ||
      refByKey.get(`${lesson.director_id}::${whyKey}`)
    );
  };
  // Track which card the user just collected — flash a subtle highlight.
  const [flashId, setFlashId] = useState<string | null>(null);
  const lastCountRef = useRef(0);
  useEffect(() => {
    if (lessons.length > lastCountRef.current) {
      const newest = lessons[lessons.length - 1];
      setFlashId(newest.id);
      const t = setTimeout(() => setFlashId(null), 1800);
      return () => clearTimeout(t);
    }
    lastCountRef.current = lessons.length;
  }, [lessons]);

  // Group by director. Lead first, then co, then any orphans (resumed
  // sessions where the director isn't in the current cast).
  const grouped = useMemo(() => {
    const byId: Record<string, LessonCard[]> = {};
    for (const l of lessons) {
      (byId[l.director_id] = byId[l.director_id] || []).push(l);
    }
    const order: { d: CastedDirector; cards: LessonCard[] }[] = [];
    if (cast.lead && byId[cast.lead.id]) {
      order.push({ d: cast.lead, cards: byId[cast.lead.id] });
      delete byId[cast.lead.id];
    }
    if (cast.co && byId[cast.co.id]) {
      order.push({ d: cast.co, cards: byId[cast.co.id] });
      delete byId[cast.co.id];
    }
    for (const [id, cards] of Object.entries(byId)) {
      order.push({
        d: { id, name: id, school: "", portraitUrl: "" },
        cards,
      });
    }
    return order;
  }, [lessons, cast]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-neutral-900 bg-white shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="flex items-start justify-between border-b border-neutral-200 px-6 py-5">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-neutral-500">
              Film School
            </p>
            <h2 className="mt-2 font-serif text-3xl leading-tight text-neutral-900">
              {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
            </h2>
            <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              real films · real techniques · cited by your directors
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-400 hover:text-neutral-900"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {lessons.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-10">
              {grouped.map(({ d, cards }) => (
                <section key={d.id}>
                  <div className="mb-4 flex items-center gap-3 border-b border-neutral-200 pb-3">
                    {d.portraitUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.portraitUrl}
                        alt={d.name}
                        className="h-10 w-10 shrink-0 object-cover grayscale"
                      />
                    ) : (
                      <div className="h-10 w-10 shrink-0 bg-neutral-100" />
                    )}
                    <div className="min-w-0">
                      <p className="font-serif text-[16px] leading-tight text-neutral-900">
                        {d.name}
                      </p>
                      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                        {cards.length} {cards.length === 1 ? "lesson" : "lessons"}
                        {d.school && ` · ${d.school}`}
                      </p>
                    </div>
                  </div>
                  <ol className="space-y-5">
                    {cards.map((c) => {
                      const ref = findRef(c);
                      return (
                        <li
                          key={c.id}
                          className={cn(
                            "border border-neutral-200 transition-all",
                            flashId === c.id && "border-neutral-900 bg-neutral-50"
                          )}
                        >
                          {ref && (
                            <div className="aspect-video overflow-hidden border-b border-neutral-200 bg-neutral-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={ref.url}
                                alt={ref.caption}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                          <div className="px-4 py-4">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="font-serif text-[18px] leading-tight text-neutral-900">
                                {c.film}
                              </p>
                              {c.year && (
                                <p className="font-mono text-[12px] tabular-nums text-neutral-500">
                                  {c.year}
                                </p>
                              )}
                            </div>
                            <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                              Technique
                            </p>
                            <p className="mt-1 font-serif text-[15px] leading-relaxed text-neutral-800">
                              {c.technique}
                            </p>
                            <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                              Why it applies
                            </p>
                            <p className="mt-1 font-serif text-[15px] italic leading-relaxed text-neutral-700">
                              &ldquo;{c.why}&rdquo;
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </div>

        {lessons.length > 0 && (
          <footer className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              All {lessons.length} lessons land in your dossier when the film is locked.
            </p>
          </footer>
        )}
      </aside>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 inline-flex h-12 w-12 items-center justify-center border border-neutral-200">
        <BookOpen className="h-5 w-5 text-neutral-400" />
      </div>
      <h3 className="font-serif text-xl text-neutral-900">No lessons collected yet.</h3>
      <p className="mt-3 max-w-sm font-serif text-[14px] leading-relaxed text-neutral-600">
        Your directors will cite real films as they work. Each citation is a
        real-world technique from cinema history. They land here. Ask them
        questions during pitch — the more curious you are, the more they teach.
      </p>
      <p className="mt-6 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
        The dossier exports every lesson as a printable lesson plan.
      </p>
    </div>
  );
}
