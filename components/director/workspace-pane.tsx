"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import type {
  Checkpoint,
  CheckpointItem,
  FinalFilmAsset,
  KeyframeAsset,
  PlateAsset,
  PlateKind,
  ShotAsset,
  TreatmentData,
  WorkspaceState,
} from "./director-types";
import type { ReferenceCard } from "./use-director";

// Plate kind display labels
const PLATE_KIND_LABEL: Record<PlateKind, string> = {
  character_sheet: "character",
  location_master: "location",
  location_variant: "variant",
  prop: "prop",
  wardrobe: "wardrobe",
  vfx_element: "vfx",
};

// Resilient image that retries on load failure. The persisted asset URL is
// occasionally not yet serving when the tile first mounts (the storage put
// races with the SSE event that adds the asset to state). A bare <img>
// shows the alt text forever; this wrapper attempts up to 4 reloads with
// exponential backoff + a cache-buster query param so transient 404s heal
// silently. Once the user clicks the tile, the modal re-fetches anyway —
// this just fixes the thumbnail.
function ResilientImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  // Reset retry state when the source URL itself changes.
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [src]);
  const onError = () => {
    if (attempt >= 4) {
      setFailed(true);
      return;
    }
    const delay = 400 * Math.pow(2, attempt);
    setTimeout(() => setAttempt((a) => a + 1), delay);
  };
  const url = attempt > 0 ? `${src}${src.includes("?") ? "&" : "?"}r=${attempt}` : src;
  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-neutral-100 text-neutral-400",
          className
        )}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
          {alt || "image"}
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className={className} onError={onError} />
  );
}

export function WorkspacePane({
  workspace,
  onApprove,
  onRegenerate,
  onRespondToCheckpoint,
  onContinueGenerating,
  onAssetClick,
  expectedCounts,
  references,
  generationId,
}: {
  workspace: WorkspaceState;
  onApprove: () => void;
  onRegenerate: () => void;
  onRespondToCheckpoint: (edits: Record<string, string>, note?: string) => void;
  onContinueGenerating?: (stage: "keyframes" | "shots") => void;
  expectedCounts?: { keyframes: number; shots: number };
  /** Director-fired teaching references (whiteboard images). Rendered above production. */
  references?: ReferenceCard[];
  /** Project id — needed for the Production Dossier download in PREMIERE. */
  generationId?: string | null;
  onAssetClick: (asset: {
    kind: "plate" | "keyframe" | "shot" | "final";
    url: string;
    ref?: string;
    description?: string;
  }) => void;
}) {
  // List-only. Canvas was confusing pre-treatment (rendered placeholder grids
  // before generation started) and the user explicitly asked to remove it.
  return (
    <div className="flex h-full flex-col overflow-hidden bg-neutral-50">
      {references && references.length > 0 && (
        <ReferencesLane references={references} />
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        {workspace.kind === "welcome" && (
          <div className="h-full overflow-y-auto">
            <WelcomeView />
          </div>
        )}
        {workspace.kind === "working" && (
          <div className="h-full overflow-y-auto">
            <WorkingView stage={workspace.stage} label={workspace.label} />
          </div>
        )}
        {workspace.kind === "treatment" && (
          <div className="h-full overflow-y-auto">
            <TreatmentView
              treatment={workspace.treatment}
              text={workspace.text}
              pending={workspace.pending}
              onApprove={onApprove}
              onRegenerate={onRegenerate}
              onRespondToCheckpoint={onRespondToCheckpoint}
            />
          </div>
        )}
        {workspace.kind === "production" && (
          <div className="h-full overflow-y-auto">
            <ProductionView
              plates={workspace.plates}
              keyframes={workspace.keyframes}
              shots={workspace.shots}
              composing={workspace.composing}
              activeCheckpoint={workspace.activeCheckpoint}
              onRespondToCheckpoint={onRespondToCheckpoint}
              onContinueGenerating={onContinueGenerating}
              expectedCounts={expectedCounts}
              onAssetClick={onAssetClick}
            />
          </div>
        )}
        {workspace.kind === "final" && (
          <div className="h-full overflow-y-auto">
            <FinalView
              film={workspace.film}
              plates={workspace.plates}
              keyframes={workspace.keyframes}
              shots={workspace.shots}
              onAssetClick={onAssetClick}
              generationId={generationId ?? null}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Welcome
// ============================================================================

function WelcomeView() {
  return (
    <div className="flex h-full items-center justify-center px-12">
      <div className="max-w-xl">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
          Workspace
        </p>
        <h2 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight text-neutral-900">
          Plates.
          <br />
          Keyframes. Shots.
          <br />
          Cut.
        </h2>
        <p className="mt-6 font-serif text-[15px] leading-relaxed text-neutral-600">
          Eight rooms. Five approval gates. Characters and locations lock in as plates.
          Each shot becomes a composed first frame, then comes alive with motion.
          Coverage, signature passes, voiceover, score — your director&apos;s choices, on screen.
          You approve every stage.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Treatment
// ============================================================================

function TreatmentView({
  treatment,
  text,
  pending,
  onApprove,
  onRegenerate,
  onRespondToCheckpoint,
}: {
  treatment: TreatmentData | null;
  text: string;
  pending: boolean;
  onApprove: () => void;
  onRegenerate: () => void;
  onRespondToCheckpoint: (edits: Record<string, string>, note?: string) => void;
}) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");

  // The treatment view only enters "awaiting approval" when write_script has
  // produced a structured treatment. If the agent only wrote prose (e.g. asked
  // a clarifying question), we render that prose but do NOT show approval
  // buttons — the user replies in the chat.
  const ready = !!treatment;
  const conversational = !treatment && !pending && text.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-12 py-14">
      <div className="flex items-baseline justify-between border-b border-neutral-200 pb-5">
        <p className="font-mono text-[13px] uppercase tracking-[0.20em] text-neutral-500">
          Treatment · 01 / 05
        </p>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
          {ready ? "awaiting approval" : conversational ? "the director is asking" : "pitching…"}
        </p>
      </div>

      {treatment ? (
        <StructuredTreatment treatment={treatment} />
      ) : text ? (
        <Markdown className="mt-6">{text}</Markdown>
      ) : (
        <PulsingSkeleton />
      )}

      <div className="mt-12 border-t border-neutral-200 pt-6">
        {conversational && (
          <div className="border-l-2 border-neutral-900 bg-neutral-50 px-4 py-3">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              Reply in the chat
            </p>
            <p className="mt-1 font-serif text-[14px] leading-snug text-neutral-700">
              The director needs an answer before writing the treatment. Type
              your reply on the left, or click <em>Re-pitch</em> below to make
              them write the treatment with their best interpretation.
            </p>
            <div className="mt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onRegenerate}
                className="h-9 rounded-none text-[12px] uppercase tracking-[0.18em] text-neutral-700 hover:bg-neutral-100"
              >
                Skip questions · just write the treatment
              </Button>
            </div>
          </div>
        )}
        {!conversational && (
          !showNote ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={onApprove}
                disabled={!ready}
                className="h-11 rounded-none bg-neutral-900 px-6 text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-neutral-900"
              >
                Approve → start plates
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNote(true)}
                disabled={!ready}
                className="h-11 rounded-none text-[12px] uppercase tracking-[0.18em] text-neutral-700 hover:bg-neutral-100 disabled:opacity-30"
              >
                Request changes
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onRegenerate}
                disabled={!ready}
                className="h-11 rounded-none text-[12px] uppercase tracking-[0.18em] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30"
              >
                Re-pitch
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                What needs to change?
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Slower pacing. Shift the grade to bleach bypass. Swap the lead reference film to something more Glazer. Cast older."
                className="min-h-[120px] w-full resize-none border border-neutral-300 bg-white p-3 font-serif text-[14px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    if (note.trim()) onRespondToCheckpoint({}, note.trim());
                  }}
                  disabled={note.trim().length === 0}
                  className="h-10 rounded-none bg-neutral-900 px-5 text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
                >
                  Send notes
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNote(false);
                    setNote("");
                  }}
                  className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900"
                >
                  cancel
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Structured treatment — renders the TreatmentData from write_script cleanly
// ============================================================================

function StructuredTreatment({ treatment }: { treatment: TreatmentData }) {
  return (
    <div className="mt-10 space-y-12">
      <div>
        <h2 className="font-serif text-5xl leading-[1.05] tracking-tight text-neutral-900">{treatment.title}</h2>
        <p className="mt-4 font-serif text-[19px] italic leading-relaxed text-neutral-700">
          {treatment.logline}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2 border-t border-neutral-200 pt-8">
        <MetaRow label="End card" value={`"${treatment.end_card}"`} />
        <MetaRow label="Duration · aspect" value={`${treatment.duration_seconds}s · ${treatment.aspect_ratio}`} />
        <MetaRow label="Tone" value={treatment.tone} />
        <MetaRow label="Camera rule" value={treatment.camera_rule} />
        <MetaRow
          label="Color script"
          value={`shadow: ${treatment.color_script.shadow} · highlight: ${treatment.color_script.highlight}`}
        />
        <MetaRow label="References" value={treatment.reference_films.join(" · ")} />
      </dl>

      <section>
        <h3 className="font-mono text-[13px] uppercase tracking-[0.20em] text-neutral-500 mb-4">
          Plates — {treatment.plates.length}
        </h3>
        <ul className="space-y-4 border-t border-neutral-900 pt-4">
          {treatment.plates.map((p) => (
            <li
              key={p.tag}
              className="grid grid-cols-[140px_1fr] gap-5 border-b border-neutral-200 pb-4"
            >
              <div>
                <p className="font-mono text-[13px] text-neutral-900">@{p.tag}</p>
                <p className="mt-0.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                  {p.kind.replace(/_/g, " ")}
                  {p.parent_tag ? ` ← @${p.parent_tag}` : ""}
                </p>
              </div>
              <p className="font-serif text-[16px] leading-relaxed text-neutral-800">
                {p.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-mono text-[13px] uppercase tracking-[0.20em] text-neutral-500 mb-4">
          Shots — {treatment.shots.length}
        </h3>
        <ul className="space-y-6 border-t border-neutral-900 pt-4">
          {treatment.shots.map((s) => (
            <li key={s.id} className="border-b border-neutral-200 pb-6">
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-[14px] text-neutral-900">
                  {s.id} · {s.label}
                </p>
                <p className="font-mono text-[12px] tabular-nums text-neutral-500">
                  {s.duration_seconds}s · {s.model}
                </p>
              </div>
              <p className="mt-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                plan: {s.keyframe_plan} · plates: {s.plate_refs.map((r) => `@${r}`).join(", ") || "—"}
              </p>
              <p className="mt-3 font-serif text-[16px] leading-relaxed text-neutral-800">
                <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
                  motion ·{" "}
                </span>
                {s.motion}
              </p>
              {s.notes && (
                <p className="mt-2 font-serif text-[14px] italic leading-relaxed text-neutral-600">
                  {s.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {treatment.music?.has_music && (
        <section>
          <h3 className="font-mono text-[13px] uppercase tracking-[0.20em] text-neutral-500 mb-3">
            Music
          </h3>
          <p className="font-serif text-[16px] leading-relaxed text-neutral-800">
            {treatment.music.description}
            {treatment.music.mood ? ` · ${treatment.music.mood}` : ""}
          </p>
        </section>
      )}

      {treatment.voiceover?.full_script && (
        <section>
          <h3 className="font-mono text-[13px] uppercase tracking-[0.20em] text-neutral-500 mb-3">
            Voiceover
          </h3>
          <p className="font-serif text-[18px] italic leading-relaxed text-neutral-900">
            &ldquo;{treatment.voiceover.full_script}&rdquo;
          </p>
          {treatment.voiceover.direction && (
            <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              {treatment.voiceover.direction}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1.5 font-serif text-[16px] leading-snug text-neutral-900">{value}</dd>
    </div>
  );
}

function PulsingSkeleton() {
  return (
    <div className="mt-10 space-y-4" aria-busy="true">
      <div className="h-10 w-2/3 animate-pulse bg-neutral-200" />
      <div className="h-4 w-full animate-pulse bg-neutral-200" />
      <div className="h-4 w-5/6 animate-pulse bg-neutral-200" />
      <div className="mt-8 h-[1px] w-full bg-neutral-200" />
      <div className="grid grid-cols-2 gap-6 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 animate-pulse bg-neutral-200" />
            <div className="h-4 w-full animate-pulse bg-neutral-200" />
          </div>
        ))}
      </div>
      <div className="mt-8 h-[1px] w-full bg-neutral-200" />
      <div className="space-y-3 pt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 w-full animate-pulse bg-neutral-200" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Working state — animated placeholder shown while a tool is running and
// nothing is ready yet (between "brief submitted" and "first asset visible")
// ============================================================================

function WorkingView({ label }: { stage: string; label: string }) {
  return (
    <div className="flex h-full items-center justify-center px-10">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center">
          <span className="absolute h-16 w-16 animate-ping rounded-full bg-neutral-900/10" />
          <span className="relative h-3 w-3 rounded-full bg-neutral-900 animate-pulse" />
        </div>
        <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-neutral-500">
          Director at work
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-tight text-neutral-900">{label}…</h2>
        <p className="mt-4 font-serif text-[14px] leading-relaxed text-neutral-500">
          You&apos;ll see the first draft here as soon as it&apos;s ready. This stage typically
          takes 30 seconds to 2 minutes.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Production (plates + keyframes + shots)
// ============================================================================

function ProductionView({
  plates,
  keyframes,
  shots,
  composing,
  activeCheckpoint,
  onRespondToCheckpoint,
  onContinueGenerating,
  expectedCounts,
  onAssetClick,
}: {
  plates: PlateAsset[];
  keyframes: KeyframeAsset[];
  shots: ShotAsset[];
  composing: boolean;
  activeCheckpoint: Checkpoint | null;
  onRespondToCheckpoint: (edits: Record<string, string>, note?: string) => void;
  onContinueGenerating?: (stage: "keyframes" | "shots") => void;
  expectedCounts?: { keyframes: number; shots: number };
  onAssetClick: (asset: {
    kind: "plate" | "keyframe" | "shot";
    url: string;
    ref?: string;
    description?: string;
  }) => void;
}) {
  const stage = activeCheckpoint?.stage;

  // Group plates by kind for display
  const platesByKind = useMemo(() => {
    const groups: Record<string, PlateAsset[]> = {};
    for (const p of plates) {
      const k = p.plateKind || "prop";
      (groups[k] = groups[k] || []).push(p);
    }
    return groups;
  }, [plates]);

  const keyframesByShot = useMemo(() => {
    const groups: Record<string, KeyframeAsset[]> = {};
    for (const k of keyframes) {
      const shotId = k.shotId || "misc";
      (groups[shotId] = groups[shotId] || []).push(k);
    }
    return groups;
  }, [keyframes]);

  return (
    <div className="mx-auto w-full max-w-5xl px-10 py-10 space-y-14">
      {activeCheckpoint && activeCheckpoint.stage !== "treatment" && (
        <CheckpointBanner stage={activeCheckpoint.stage} summary={activeCheckpoint.summary} />
      )}

      {/* Plates — grouped by kind */}
      <section>
        <SectionHeader
          step="WORLD"
          label="Cast & locations · the production bible"
          count={plates.length}
          active={stage === "plates"}
        />
        {plates.length === 0 ? (
          <EmptyPanel message="Generating the plates…" />
        ) : (
          <div className="space-y-10">
            {Object.entries(platesByKind).map(([kind, items]) => (
              <div key={kind}>
                <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                  {PLATE_KIND_LABEL[kind as PlateKind] || kind} · {items.length}
                </p>
                <ApprovalGrid
                  items={items.map((p) => ({
                    ref: `@${p.tag}`,
                    label: `@${p.tag}`,
                    sub: PLATE_KIND_LABEL[p.plateKind] || p.plateKind,
                    url: p.url,
                    kind: "plate" as const,
                    description: p.description,
                  }))}
                  active={stage === "plates"}
                  onRespondToCheckpoint={onRespondToCheckpoint}
                  onAssetClick={onAssetClick}
                />
              </div>
            ))}
            {stage === "plates" && (
              <BulkActions
                label={`Approve all ${plates.length} plates · continue to keyframes`}
                onApprove={() => onRespondToCheckpoint({})}
              />
            )}
          </div>
        )}
      </section>

      {/* Keyframes — grouped by shot */}
      {(keyframes.length > 0 || stage === "keyframes") && (
        <section>
          <SectionHeader
            step="STORYBOARD"
            label="Keyframes · the first frame of every shot"
            count={keyframes.length}
            active={stage === "keyframes"}
          />
          {keyframes.length === 0 ? (
            <EmptyPanel message="Composing keyframes from the plates…" />
          ) : (
            <div className="space-y-10">
              {Object.entries(keyframesByShot).map(([shotId, kfs]) => (
                <div key={shotId}>
                  <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                    {shotId === "misc" ? "miscellaneous" : shotId.replace("_", " ")}
                  </p>
                  <ApprovalGrid
                    items={kfs.map((k) => ({
                      ref: k.tag ? `@${k.tag}` : k.id,
                      label: k.tag ? `@${k.tag}` : `${k.shotId || ""} · ${k.role || ""}`,
                      sub: k.role || "hero",
                      url: k.url,
                      kind: "keyframe" as const,
                      description: k.prompt,
                    }))}
                    active={stage === "keyframes"}
                    onRespondToCheckpoint={onRespondToCheckpoint}
                    onAssetClick={onAssetClick}
                  />
                </div>
              ))}
              {stage === "keyframes" && (
                <KeyframeBulkActions
                  keyframeCount={keyframes.length}
                  expected={expectedCounts?.keyframes}
                  onApprove={() => onRespondToCheckpoint({})}
                  onContinueGenerating={
                    onContinueGenerating ? () => onContinueGenerating("keyframes") : undefined
                  }
                />
              )}
            </div>
          )}
        </section>
      )}

      {/* Shots */}
      {(shots.length > 0 || stage === "shots") && (
        <section>
          <SectionHeader
            step="SHOOT"
            label="Shots · the take and any alternates"
            count={shots.length}
            active={stage === "shots"}
          />
          {shots.length === 0 ? (
            <EmptyPanel message="Shooting — animating the keyframes…" />
          ) : (
            <div className="space-y-6">
              {shots.map((s, i) => (
                <ShotCard
                  key={s.id}
                  index={i + 1}
                  shot={s}
                  onAssetClick={onAssetClick}
                  checkpointActive={stage === "shots"}
                  checkpointItem={activeCheckpoint?.items.find((it) => it.ref === `shot_${i + 1}`)}
                  onRespondToCheckpoint={onRespondToCheckpoint}
                />
              ))}
              {stage === "shots" && (
                <BulkActions
                  label={`Approve all ${shots.length} shots · go to the cut`}
                  onApprove={() => onRespondToCheckpoint({})}
                />
              )}
            </div>
          )}
        </section>
      )}

      {/* Composing */}
      {composing && (
        <section>
          <div className="border-l-2 border-neutral-900 bg-white p-6">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              POST · cutting
            </p>
            <p className="mt-2 font-serif text-2xl text-neutral-900">Composing the final film…</p>
            <div className="mt-4 h-[2px] w-full overflow-hidden bg-neutral-200">
              <div className="h-full w-1/3 animate-[pulse_1.8s_ease-in-out_infinite] bg-neutral-900" />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({
  step,
  label,
  count,
  active,
}: {
  step: string;
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <header className="mb-6 flex items-baseline justify-between border-b border-neutral-900 pb-3">
      <div className="flex items-baseline gap-4">
        <p className="font-mono text-[11px] tabular-nums text-neutral-500">{step}</p>
        <p className="font-serif text-2xl text-neutral-900">{label}</p>
        {active && (
          <span className="rounded-none border border-neutral-900 px-2 py-0.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-900">
            review
          </span>
        )}
      </div>
      <p className="font-mono text-[11px] tabular-nums text-neutral-400">
        {count} {count === 1 ? "item" : "items"}
      </p>
    </header>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-neutral-400">
        {message}
      </p>
    </div>
  );
}

function CheckpointBanner({ stage, summary }: { stage: string; summary: string }) {
  const stageLabel: Record<string, string> = {
    plates: "Review the plates",
    keyframes: "Review the keyframes",
    shots: "Review the shots",
    final_cut: "Review the final cut",
  };
  return (
    <div className="border-l-2 border-neutral-900 bg-white p-5">
      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
        Checkpoint
      </p>
      <h3 className="mt-1 font-serif text-2xl text-neutral-900">{stageLabel[stage] || stage}</h3>
      {summary && (
        <p className="mt-3 font-serif text-[14px] leading-relaxed text-neutral-700">{summary}</p>
      )}
      <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
        Click any tile to request a specific change · approve all to continue
      </p>
    </div>
  );
}

function BulkActions({ label, onApprove }: { label: string; onApprove: () => void }) {
  return (
    <div className="mt-4 border-t border-neutral-200 pt-6">
      <Button
        type="button"
        onClick={onApprove}
        className="h-11 rounded-none bg-neutral-900 px-6 text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
      >
        {label}
      </Button>
    </div>
  );
}

/**
 * Smart BulkActions for the keyframes stage. When the set is incomplete
 * (e.g. the user clicked Stop mid-generation), the primary CTA becomes
 * "Continue generating" and "Start shooting with partial set" is demoted
 * to a secondary action.
 */
function KeyframeBulkActions({
  keyframeCount,
  expected,
  onApprove,
  onContinueGenerating,
}: {
  keyframeCount: number;
  expected?: number;
  onApprove: () => void;
  onContinueGenerating?: () => void;
}) {
  const isIncomplete =
    typeof expected === "number" && expected > 0 && keyframeCount < expected;

  if (!isIncomplete || !onContinueGenerating) {
    return (
      <BulkActions
        label={`Approve all ${keyframeCount} keyframes · start shooting`}
        onApprove={onApprove}
      />
    );
  }

  const remaining = (expected as number) - keyframeCount;
  return (
    <div className="mt-4 border-t border-neutral-200 pt-6 space-y-3">
      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
        {keyframeCount} of {expected} keyframes rendered · {remaining} remaining
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={onContinueGenerating}
          className="h-11 rounded-none bg-neutral-900 px-6 text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
        >
          Continue generating · {remaining} keyframe{remaining === 1 ? "" : "s"}
        </Button>
        <Button
          type="button"
          onClick={onApprove}
          variant="outline"
          className="h-11 rounded-none border-neutral-300 bg-white px-6 text-[12px] uppercase tracking-[0.18em] text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
        >
          Start shooting with these {keyframeCount}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// ApprovalGrid — shared by plates and keyframes
// ============================================================================

type GridItem = {
  ref: string;
  label: string;
  sub: string;
  url: string;
  kind: "plate" | "keyframe";
  description?: string;
};

function ApprovalGrid({
  items,
  active,
  onRespondToCheckpoint,
  onAssetClick,
}: {
  items: GridItem[];
  active: boolean;
  onRespondToCheckpoint: (edits: Record<string, string>, note?: string) => void;
  onAssetClick: (asset: {
    kind: "plate" | "keyframe";
    url: string;
    ref?: string;
    description?: string;
  }) => void;
}) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editingRef, setEditingRef] = useState<string | null>(null);
  const hasEdits = useMemo(
    () => Object.values(edits).some((v) => v.trim().length > 0),
    [edits]
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
        {items.map((it) => (
          <ApprovalTile
            key={it.ref}
            item={it}
            active={active}
            editValue={edits[it.ref] || ""}
            editing={editingRef === it.ref}
            onEdit={() => setEditingRef(it.ref)}
            onCancelEdit={() => {
              setEditingRef(null);
              setEdits((e) => ({ ...e, [it.ref]: "" }));
            }}
            onEditChange={(v) => setEdits((e) => ({ ...e, [it.ref]: v }))}
            onClick={() =>
              onAssetClick({
                kind: it.kind,
                url: it.url,
                ref: it.ref,
                description: it.description,
              })
            }
          />
        ))}
      </div>

      {active && hasEdits && (
        <div className="mt-6 flex items-center gap-4 border-t border-neutral-200 pt-5">
          <Button
            type="button"
            onClick={() => {
              onRespondToCheckpoint(edits);
              setEdits({});
              setEditingRef(null);
            }}
            className="h-10 rounded-none bg-neutral-900 px-5 text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
          >
            Send {Object.keys(edits).filter((k) => edits[k].trim()).length} change(s)
          </Button>
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            Only flagged items will be edited
          </p>
        </div>
      )}
    </div>
  );
}

function ApprovalTile({
  item,
  active,
  editing,
  editValue,
  onEdit,
  onCancelEdit,
  onEditChange,
  onClick,
}: {
  item: GridItem;
  active: boolean;
  editing: boolean;
  editValue: string;
  onEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (v: string) => void;
  onClick: () => void;
}) {
  const flagged = editValue.trim().length > 0;

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative aspect-square w-full overflow-hidden border-2 bg-neutral-100 transition-all",
          flagged
            ? "border-neutral-900"
            : "border-neutral-200 group-hover:border-neutral-500"
        )}
      >
        <ResilientImg
          src={item.url}
          alt={item.label}
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
        />
        {flagged && (
          <span className="absolute left-2 top-2 bg-neutral-900 px-1.5 py-0.5 font-mono text-[12px] uppercase tracking-[0.18em] text-white">
            changes
          </span>
        )}
      </button>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            {item.sub}
          </p>
          <p className="truncate font-mono text-[11px] text-neutral-900">{item.label}</p>
        </div>
        {active && !editing && (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900"
          >
            edit
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-2">
          <textarea
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            placeholder="One surgical change + preserve the rest."
            autoFocus
            className="min-h-[72px] w-full resize-none border border-neutral-300 bg-white p-2 font-serif text-[13px] leading-snug text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
          />
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={onCancelEdit}
              className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Shot card with per-shot re-shoot controls
// ============================================================================

function ShotCard({
  index,
  shot,
  onAssetClick,
  checkpointActive,
  checkpointItem,
  onRespondToCheckpoint,
}: {
  index: number;
  shot: ShotAsset;
  onAssetClick: (asset: {
    kind: "shot";
    url: string;
    ref?: string;
    description?: string;
  }) => void;
  checkpointActive: boolean;
  checkpointItem?: CheckpointItem;
  onRespondToCheckpoint: (edits: Record<string, string>, note?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const shotRef = checkpointItem?.ref || `shot_${index}`;
  const aspect = shot.aspectRatio || "16:9";

  const aspectClass =
    aspect === "9:16"
      ? "aspect-[9/16] max-h-[70vh] mx-auto"
      : aspect === "1:1"
      ? "aspect-square"
      : aspect === "21:9"
      ? "aspect-[21/9]"
      : aspect === "4:3"
      ? "aspect-[4/3]"
      : aspect === "3:4"
      ? "aspect-[3/4] max-h-[70vh] mx-auto"
      : "aspect-video";

  return (
    <article className="border border-neutral-200 bg-white">
      {shot.imageUrls && shot.imageUrls.length > 0 && (
        <div className="border-b border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            reference pack · {shot.imageUrls.length}
          </p>
          <div className="flex gap-1.5 overflow-x-auto">
            {shot.imageUrls.map((u, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  onAssetClick({ kind: "shot", url: u, ref: `ref_${i + 1}` })
                }
                className="relative h-14 w-14 shrink-0 overflow-hidden border border-neutral-200 hover:border-neutral-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`ref ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          onAssetClick({
            kind: "shot",
            url: shot.videoUrl,
            ref: shotRef,
            description: shot.prompt,
          })
        }
        className={cn("relative block w-full overflow-hidden bg-black", aspectClass)}
      >
        <video
          src={shot.videoUrl}
          className="h-full w-full object-cover"
          controls
          muted
          playsInline
          preload="metadata"
        />
      </button>

      <div className="p-4">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            shot {String(index).padStart(2, "0")}
          </p>
          <p className="font-mono text-[11px] text-neutral-500 tabular-nums">
            {shot.mode} · {shot.durationLabel}s
          </p>
        </div>
        {shot.prompt && (
          <p className="mt-3 line-clamp-3 font-serif text-[14px] leading-snug text-neutral-800">
            {shot.prompt}
          </p>
        )}

        {checkpointActive && (
          <div className="mt-4 border-t border-neutral-200 pt-3">
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-600 hover:text-neutral-900"
              >
                Request changes to this shot
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Slower camera. Shift the grade warmer. Re-shoot with the character looking away."
                  className="min-h-[72px] w-full resize-none border border-neutral-300 bg-white p-2 font-serif text-[13px] leading-snug text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      if (note.trim()) {
                        onRespondToCheckpoint({ [shotRef]: note.trim() });
                        setNote("");
                        setEditing(false);
                      }
                    }}
                    disabled={note.trim().length === 0}
                    className="h-8 rounded-none bg-neutral-900 px-4 text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
                  >
                    Re-shoot
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setNote("");
                    }}
                    className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900"
                  >
                    cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ============================================================================
// Final cut
// ============================================================================

function FinalView({
  film,
  plates,
  keyframes,
  shots,
  onAssetClick,
  generationId,
}: {
  film: FinalFilmAsset;
  plates: PlateAsset[];
  keyframes: KeyframeAsset[];
  shots: ShotAsset[];
  onAssetClick: (asset: {
    kind: "plate" | "keyframe" | "shot" | "final";
    url: string;
    ref?: string;
    description?: string;
  }) => void;
  generationId: string | null;
}) {
  const aspect = film.aspectRatio || "16:9";
  const aspectClass =
    aspect === "9:16"
      ? "aspect-[9/16] max-h-[80vh] mx-auto"
      : aspect === "1:1"
      ? "aspect-square max-w-[80vh] mx-auto"
      : aspect === "21:9"
      ? "aspect-[21/9]"
      : aspect === "4:3"
      ? "aspect-[4/3]"
      : aspect === "3:4"
      ? "aspect-[3/4] max-h-[80vh] mx-auto"
      : "aspect-video";

  return (
    <div className="mx-auto w-full max-w-5xl px-10 py-12">
      <div className="flex items-baseline justify-between border-b border-neutral-200 pb-4">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
          PREMIERE
        </p>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
          complete
        </p>
      </div>
      <h2 className="mt-5 font-serif text-5xl leading-tight text-neutral-900">
        Cut complete.
      </h2>

      <div className="mt-8 border-l-2 border-neutral-900 bg-black">
        <div className={cn("relative w-full overflow-hidden", aspectClass)}>
          <video src={film.url} className="h-full w-full" controls autoPlay playsInline />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <a
          href={film.url}
          download
          className="inline-flex h-11 items-center rounded-none bg-neutral-900 px-5 text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-800"
        >
          Download film
        </a>
        {generationId && (
          <DossierDownloadButtons generationId={generationId} />
        )}
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500 tabular-nums">
          {plates.length} plates · {keyframes.length} keyframes · {shots.length} shots · {aspect}
        </p>
      </div>

      {(plates.length > 0 || shots.length > 0) && (
        <div className="mt-14 space-y-10">
          {plates.length > 0 && (
            <section>
              <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                Plates used
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {plates.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onAssetClick({
                        kind: "plate",
                        url: p.url,
                        ref: `@${p.tag}`,
                        description: p.description,
                      })
                    }
                    className="group"
                  >
                    <div className="aspect-square overflow-hidden border border-neutral-200 bg-neutral-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.tag}
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    </div>
                    <p className="mt-1.5 truncate font-mono text-[11px] text-neutral-500">
                      @{p.tag}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}
          {shots.length > 0 && (
            <section>
              <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                Shots
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {shots.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      onAssetClick({
                        kind: "shot",
                        url: s.videoUrl,
                        ref: `shot_${i + 1}`,
                        description: s.prompt,
                      })
                    }
                  >
                    <div className="aspect-video overflow-hidden border border-neutral-200 bg-black">
                      <video
                        src={s.videoUrl}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                      />
                    </div>
                    <p className="mt-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                      shot {String(i + 1).padStart(2, "0")} · {s.mode}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ReferencesLane — horizontal scrollable strip showing teaching examples
 * conjured by the directors (gpt_image_2 via the whiteboard tool). Sits
 * above production lanes; never mixes with plates/keyframes/shots.
 */
function ReferencesLane({ references }: { references: ReferenceCard[] }) {
  const [expanded, setExpanded] = useState(true);
  const [openCard, setOpenCard] = useState<ReferenceCard | null>(null);
  // Track the latest reference id so we can flag it with NEW + a brief
  // pulse animation. The director's persona is now told to point the user
  // at this card when they fire cite_lesson; the visual emphasis makes
  // sure the page actually catches the eye.
  const newestId = references[references.length - 1]?.id;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // Auto-scroll the newest card into view whenever one lands.
  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollLeft = scrollerRef.current.scrollWidth;
  }, [references.length]);
  return (
    <div className="border-b border-neutral-200 bg-white">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-2 hover:bg-neutral-50"
      >
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
          Film school references · {references.length}
        </p>
        <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
          {expanded ? "hide" : "show"}
        </span>
      </button>
      {expanded && (
        <div
          ref={scrollerRef}
          className="overflow-x-auto border-t border-neutral-100 px-5 pb-4 pt-3"
        >
          <div className="flex gap-4">
            {references.map((r) => {
              const isNewest = r.id === newestId;
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setOpenCard(r)}
                  className={`group relative flex w-[280px] shrink-0 flex-col text-left transition-transform duration-300 ${
                    isNewest ? "ring-1 ring-black/80" : ""
                  }`}
                  title="Click to view full size"
                >
                  {isNewest && (
                    <span className="absolute right-1 top-1 z-10 bg-black px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white">
                      new
                    </span>
                  )}
                  <div className="aspect-video overflow-hidden border border-neutral-200 bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.url}
                      alt={r.caption}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                  <figcaption className="mt-2 line-clamp-2 font-serif text-[13px] leading-snug text-neutral-800">
                    {r.caption}
                  </figcaption>
                  <p className="mt-1 truncate font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
                    via {r.director_name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Full-size modal — click outside or press Esc to close */}
      {openCard && (
        <ReferenceModal card={openCard} onClose={() => setOpenCard(null)} />
      )}
    </div>
  );
}

/**
 * DossierDownloadButtons — fetches the Production Dossier manifest from
 * /api/dossier/[generationId] and exposes individual download buttons for
 * each artifact: treatment.md, lesson_plan.md, directors_notes.md,
 * shot_list.csv, project.json. Each is generated client-side from the
 * manifest as a Blob and offered via an <a download> trick.
 *
 * Per-asset video / image downloads stay on their existing URLs (Supabase /
 * Runway CDN) and are accessed via the inline grids below.
 */
function DossierDownloadButtons({ generationId }: { generationId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerDownload = (filename: string, content: string, mime = "text/plain") => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dossier/${generationId}`);
      if (!res.ok) throw new Error(`dossier ${res.status}`);
      const data = await res.json();
      const stamp = new Date().toISOString().slice(0, 10);
      const slug = (data.project?.title || "untitled")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40);
      triggerDownload(
        `${slug}-treatment-${stamp}.md`,
        data.treatment_md,
        "text/markdown"
      );
      triggerDownload(
        `${slug}-lesson-plan-${stamp}.md`,
        data.lesson_plan_md,
        "text/markdown"
      );
      triggerDownload(
        `${slug}-directors-notes-${stamp}.md`,
        data.directors_notes_md,
        "text/markdown"
      );
      triggerDownload(`${slug}-shot-list-${stamp}.csv`, data.shot_list_csv, "text/csv");
      triggerDownload(
        `${slug}-project-${stamp}.json`,
        JSON.stringify(data.project_json, null, 2),
        "application/json"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={downloadAll}
        disabled={loading}
        className="inline-flex h-11 items-center rounded-none border border-neutral-900 bg-white px-5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:opacity-50"
      >
        {loading ? "Preparing dossier…" : "Download dossier"}
      </button>
      {error && (
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function ReferenceModal({
  card,
  onClose,
}: {
  card: ReferenceCard;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 border border-neutral-300 bg-white px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
        >
          Close · esc
        </button>
        <div className="bg-neutral-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.url}
            alt={card.caption}
            className="block w-full"
          />
        </div>
        <div className="border-t border-neutral-200 bg-white px-6 py-4">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
            via {card.director_name}
          </p>
          <p className="mt-2 font-serif text-[16px] leading-snug text-neutral-900">
            {card.caption}
          </p>
        </div>
      </div>
    </div>
  );
}
