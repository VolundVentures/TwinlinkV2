"use client";

// StagedLoader — animates through the actual phases of session creation.
//
// The session API takes 30-90s in practice (Runway queues + WebRTC
// establishment). Showing a single static "Loading..." for that whole window
// is dead air. Instead we animate a sequence of stages with the actual
// director names, so the user has a sense of progress.

import { useEffect, useState } from "react";

export type LoaderStage = {
  label: string;
  /** Estimated milliseconds for this stage. The progress bar uses this. */
  estimateMs: number;
};

export function StagedLoader({
  leadName,
  coName,
  done,
}: {
  leadName: string;
  coName?: string | null;
  /** When set true, the loader fades out. */
  done: boolean;
}) {
  const stages: LoaderStage[] = coName
    ? [
        { label: `Calling ${leadName}…`, estimateMs: 8_000 },
        { label: `Calling ${coName}…`, estimateMs: 8_000 },
        { label: "Provisioning the room…", estimateMs: 25_000 },
        { label: "Establishing connection…", estimateMs: 12_000 },
      ]
    : [
        { label: `Calling ${leadName}…`, estimateMs: 8_000 },
        { label: "Provisioning the room…", estimateMs: 30_000 },
        { label: "Establishing connection…", estimateMs: 12_000 },
      ];

  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (done || stageIndex >= stages.length - 1) return;
    const t = setTimeout(
      () => setStageIndex((i) => Math.min(i + 1, stages.length - 1)),
      stages[stageIndex].estimateMs
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageIndex, done]);

  return (
    <div
      className={[
        "flex min-h-screen w-full flex-col items-center justify-center bg-white text-neutral-900 transition-opacity duration-700",
        done ? "opacity-0" : "opacity-100",
      ].join(" ")}
    >
      <div className="flex flex-col items-center gap-6">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-500">
          AUTEUR
        </p>
        <div className="flex h-1 w-64 overflow-hidden bg-neutral-200">
          <div
            className="h-full bg-neutral-900 transition-all duration-700 ease-out"
            style={{
              width: `${((stageIndex + 1) / stages.length) * 100}%`,
            }}
          />
        </div>
        <p
          key={stageIndex}
          className="animate-[fadein_400ms_ease-out] font-serif text-2xl tracking-tight"
        >
          {stages[stageIndex].label}
        </p>
        <p className="max-w-md text-center font-mono text-[11px] uppercase leading-relaxed tracking-wider text-neutral-500">
          The directors are getting into the room. This usually takes about a
          minute.
        </p>
      </div>
      <style jsx>{`
        @keyframes fadein {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
