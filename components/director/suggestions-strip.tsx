"use client";

// Suggestions strip — pending creative suggestions from the directors.
//
// AUTEUR (May 2026): the directors propose; the user decides. Every actionable
// suggestion fired by a director (write the treatment, change a plate, edit
// a shot) lands here as a card with Apply / Pass buttons.
//
// The user has two ways to confirm a suggestion: click Apply on the card, or
// say "go ahead" verbally to the director (which fires commit_proposal,
// routes to applySuggestion). Either path commits.
//
// Visual: thin horizontal strip below the workspace. Each card stacks
// vertically. When there are no pending suggestions, the strip collapses.

import { useMemo, useState } from "react";
import { Check, X, History, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Suggestion } from "./use-director";
import type { CastedDirector } from "./director-types";

export type SuggestionsStripProps = {
  suggestions: Suggestion[];
  cast: { lead: CastedDirector | null; co: CastedDirector | null };
  onApply: (suggestionId: string, directorId: string) => void;
  onPass: (suggestionId: string, directorId: string) => void;
};

export function SuggestionsStrip({
  suggestions,
  cast,
  onApply,
  onPass,
}: SuggestionsStripProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const pending = useMemo(
    () => suggestions.filter((s) => s.status === "pending"),
    [suggestions]
  );
  const decided = useMemo(
    () =>
      suggestions
        .filter((s) => s.status !== "pending")
        .sort((a, b) => b.created_at - a.created_at),
    [suggestions]
  );

  // The whole strip collapses when there's nothing to show.
  if (pending.length === 0 && decided.length === 0) return null;

  // Build a quick lookup so we can show portraits.
  const portraitByDirectorId: Record<string, string | undefined> = {};
  if (cast.lead) portraitByDirectorId[cast.lead.id] = cast.lead.portraitUrl;
  if (cast.co) portraitByDirectorId[cast.co.id] = cast.co.portraitUrl;

  // Bulk apply helper: only show when there are 2+ pending from the same director.
  const byDirector = pending.reduce<Record<string, Suggestion[]>>((acc, s) => {
    (acc[s.director_id] = acc[s.director_id] || []).push(s);
    return acc;
  }, {});
  const bulkCandidate = Object.entries(byDirector).find(([, list]) => list.length >= 2);

  return (
    <div className="border-t-2 border-neutral-900 bg-white">
      {pending.length > 0 && (
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-2">
          <div className="flex items-baseline gap-3">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-700">
              Pending suggestions · {pending.length}
            </p>
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
              click Apply, or tell the director &ldquo;go ahead&rdquo;
            </p>
          </div>
          {bulkCandidate && (
            <button
              onClick={() => {
                const [directorId, list] = bulkCandidate;
                for (const s of list) onApply(s.id, directorId);
              }}
              className="border border-neutral-900 bg-neutral-900 px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
            >
              Apply all {bulkCandidate[1].length} from{" "}
              {pending.find((s) => s.director_id === bulkCandidate[0])?.director_name}
            </button>
          )}
        </div>
      )}
      {pending.length > 0 && (
      <ul className="max-h-[280px] overflow-y-auto divide-y divide-neutral-100">
        {pending.map((s) => (
          <li key={s.id} className="flex items-start gap-3 px-5 py-3">
            <DirectorPortrait
              src={portraitByDirectorId[s.director_id]}
              name={s.director_name}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                <span>{s.director_name}</span>
                <span className="text-neutral-300">·</span>
                <span>{labelFor(s)}</span>
              </p>
              <p className="mt-1.5 font-serif text-[16px] leading-snug text-neutral-900">
                {s.summary}
              </p>
              {s.type === "alternative" && (
                <p className="mt-1 truncate font-mono text-[11px] text-neutral-500">
                  on{" "}
                  <span className="text-neutral-900">{s.target_ref}</span>
                </p>
              )}
              {(s.type === "signature_pass" || s.type === "coverage") && (
                <p className="mt-1 truncate font-mono text-[11px] text-neutral-500">
                  on <span className="text-neutral-900">{s.target_ref}</span>
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => onApply(s.id, s.director_id)}
                title="Apply this suggestion"
                className="flex items-center gap-1 border border-neutral-900 bg-neutral-900 px-2.5 py-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
              >
                <Check className="h-3 w-3" />
                Apply
              </button>
              <button
                onClick={() => onPass(s.id, s.director_id)}
                title="Pass on this suggestion"
                className="flex items-center gap-1 border border-neutral-300 bg-white px-2.5 py-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
              >
                <X className="h-3 w-3" />
                Pass
              </button>
            </div>
          </li>
        ))}
      </ul>
      )}

      {/* Decisions log — applied + passed, history of what's been chosen */}
      {decided.length > 0 && (
        <div className={cn(pending.length > 0 && "border-t border-neutral-200")}>
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex w-full items-center justify-between bg-neutral-50 px-5 py-2 hover:bg-neutral-100"
          >
            <span className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-600">
              <History className="h-3 w-3" />
              Decisions log · {decided.length}
            </span>
            <span className="text-neutral-500">
              {historyOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </span>
          </button>
          {historyOpen && (
            <ul className="max-h-[200px] overflow-y-auto divide-y divide-neutral-100 bg-neutral-50/40">
              {decided.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-3 px-5 py-2"
                >
                  <span
                    className={cn(
                      "mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                      s.status === "applied" ? "bg-neutral-900" : "bg-neutral-400"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                      <span className="text-neutral-900">{s.director_name}</span>
                      <span className="text-neutral-300">·</span>
                      <span>
                        {s.status === "applied" ? "applied" : "passed"}
                      </span>
                      <span className="text-neutral-300">·</span>
                      <span className="text-neutral-400">
                        {labelFor(s)}
                      </span>
                    </p>
                    <p className="mt-1 truncate font-serif text-[14px] leading-snug text-neutral-700">
                      {s.summary}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function labelFor(s: Suggestion): string {
  switch (s.type) {
    case "treatment":
      return "write the treatment";
    case "alternative":
      return "change an asset";
    case "signature_pass":
      return "signature pass";
    case "coverage":
      return "alternate angle";
  }
}

function DirectorPortrait({
  src,
  name,
}: {
  src: string | undefined;
  name: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "h-9 w-9 shrink-0 bg-neutral-100",
          "flex items-center justify-center font-mono text-[11px] text-neutral-500"
        )}
      >
        {name.slice(0, 1)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="h-9 w-9 shrink-0 object-cover grayscale"
    />
  );
}
