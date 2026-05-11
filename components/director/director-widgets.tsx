"use client";

// DirectorWidgets — single-active-director floating widget.
//
// AUTEUR (May 2026): only ONE director is on a live realtime call at a time.
// The other director is "in the wings" — visible as a portrait card with a
// Switch button. When the user clicks Switch, the parent ends the current
// session, flips activeDirectorId, and a fresh session is created for the
// new active director (~10-30s wait while the room comes up).
//
// This is the architectural choice that gives us reliable demos. Two parallel
// AvatarProviders / LiveKitRooms in one tab is not reliably supported by the
// SDK (undocumented) — sometimes one of the two stalls during connection
// negotiation. Single-active sidesteps that entirely.
//
// The widget is draggable (header is the handle) and remembers its position
// in localStorage.
//
// Recovery: a Reload button next to End ends the current session and triggers
// a parent refetch (same active director) — used when the avatar tile goes
// black or the room stops responding. Connection state from useAvatarSession()
// is surfaced as a badge so the user sees what's happening; an `error` state
// auto-prompts a reload affordance.

import { useEffect, useRef, useState } from "react";
import {
  AvatarProvider,
  AvatarVideo,
  UserVideo,
  useAvatarSession,
  useLocalMedia,
  useClientEvent,
  useTranscript,
} from "@runwayml/avatars-react";
import "@runwayml/avatars-react/styles.css";
import {
  Mic,
  MicOff,
  MonitorUp,
  MonitorOff,
  X,
  Loader2,
  ArrowLeftRight,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type WidgetActiveParticipant = {
  directorId: string;
  directorName: string;
  avatarId: string;
  sessionId: string;
  sessionKey: string;
  portraitUrl?: string;
  school?: string;
};

export type WidgetWingsParticipant = {
  directorId: string;
  directorName: string;
  avatarId: string;
  portraitUrl?: string;
  school?: string;
};

export type DirectorWidgetsProps = {
  active: WidgetActiveParticipant;
  wings: WidgetWingsParticipant | null;
  /** Currently active room — drives the phase pill. */
  phase?: string;
  onEnd?: () => void;
  /** Called when the user clicks "Switch to [wings]" — parent ends current
      session, flips activeDirectorId, refetches. */
  onSwitchToWings?: () => void;
  /** Reload the active director's session. Parent ends current session and
      refetches (same activeDirectorId). Used when the avatar gets stuck
      (black tile, no audio, error state). */
  onReload?: () => void;
  onVisualExample?: (
    args:
      | { technique?: string; description?: string; caption?: string }
      | null
      | undefined,
    director: { id: string; name: string }
  ) => void;
  onCiteLesson?: (
    args:
      | { film?: string; technique?: string; why?: string; year?: number }
      | null
      | undefined,
    director: { id: string; name: string }
  ) => void;
  /** Continuously fed the active session's transcript so the parent can hand
      it to the next session (switch / reload) — that's how the wings director
      "remembers" what the lead just said with the user. */
  onTranscriptUpdate?: (
    transcript: Array<{ speaker: "user" | "director"; text: string }>
  ) => void;
  onProposalEvent?: (
    eventName:
      | "propose_treatment"
      | "propose_alternative"
      | "propose_signature_pass"
      | "propose_coverage"
      | "commit_proposal"
      | "dismiss_proposal"
      | "approve_checkpoint"
      | "reject_checkpoint",
    args: Record<string, unknown> | null | undefined,
    director: { id: string; name: string }
  ) => void;
};

const PROPOSAL_EVENTS = [
  "propose_treatment",
  "propose_alternative",
  "propose_signature_pass",
  "propose_coverage",
  "commit_proposal",
  "dismiss_proposal",
  "approve_checkpoint",
  "reject_checkpoint",
] as const;

export function DirectorWidgets({
  active,
  wings,
  phase,
  onEnd,
  onSwitchToWings,
  onReload,
  onVisualExample,
  onCiteLesson,
  onTranscriptUpdate,
  onProposalEvent,
}: DirectorWidgetsProps) {
  // Draggable position. Default top-right; persists in localStorage.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("auteur:widget-pos");
      if (raw) return JSON.parse(raw) as { left: number; top: number };
    } catch {
      /* ignore */
    }
    return null;
  });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
  } | null>(null);

  useEffect(() => {
    if (!pos) return;
    try {
      localStorage.setItem("auteur:widget-pos", JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos]);

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    const start = pos ?? {
      left: window.innerWidth - 320 - 16,
      top: 72,
    };
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: start.left,
      origTop: start.top,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const next = {
        left: Math.max(
          8,
          Math.min(
            window.innerWidth - 320 - 8,
            dragRef.current.origLeft + (ev.clientX - dragRef.current.startX)
          )
        ),
        top: Math.max(
          8,
          Math.min(
            window.innerHeight - 200,
            dragRef.current.origTop + (ev.clientY - dragRef.current.startY)
          )
        ),
      };
      setPos(next);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const style: React.CSSProperties = pos
    ? { left: pos.left, top: pos.top, right: "auto" }
    : { right: 16, top: 72 };

  return (
    <div
      style={style}
      className={cn(
        "pointer-events-auto fixed z-30 flex w-[320px] flex-col",
        "border border-neutral-900 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
      )}
    >
      {/* Header — drag handle */}
      <div
        onMouseDown={onDragStart}
        className="flex cursor-move select-none items-center justify-between border-b border-neutral-200 px-3 py-2"
        title="Drag to move"
      >
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
          ⋮⋮ On call · {active.directorName}
        </p>
        {phase && (
          <span className="border border-neutral-900 px-1.5 py-0.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-900">
            {phase}
          </span>
        )}
      </div>

      {/* Active director provider — renders avatar tile + listeners + controls */}
      <AvatarProvider
        avatarId={active.avatarId}
        sessionId={active.sessionId}
        sessionKey={active.sessionKey}
        audio
        video
        fallback={<TileSkeleton label={`On call · ${active.directorName}`} />}
      >
        <ActiveTile label={`On call · ${active.directorName}`} />
        {/* Hidden UserVideo so the SDK fully wires the local-media lifecycle.
            See SDK source — UserVideo subscribes to localVideoTrackRef which
            seems to settle the LiveKit room state. Visually invisible. */}
        <UserVideo
          className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
          aria-hidden="true"
        />
        <ToolListener
          event="show_visual_example"
          onInvoke={(args) =>
            onVisualExample?.(
              args as
                | { technique?: string; description?: string; caption?: string }
                | null
                | undefined,
              { id: active.directorId, name: active.directorName }
            )
          }
        />
        <ToolListener
          event="cite_lesson"
          onInvoke={(args) =>
            onCiteLesson?.(
              args as
                | {
                    film?: string;
                    technique?: string;
                    why?: string;
                    year?: number;
                  }
                | null
                | undefined,
              { id: active.directorId, name: active.directorName }
            )
          }
        />
        {PROPOSAL_EVENTS.map((evt) => (
          <ToolListener
            key={`active-${evt}`}
            event={evt}
            onInvoke={(args) =>
              onProposalEvent?.(
                evt,
                args as Record<string, unknown> | null | undefined,
                { id: active.directorId, name: active.directorName }
              )
            }
          />
        ))}
        <ConnectionWatch onReload={onReload} />
        {onTranscriptUpdate && (
          <TranscriptCapture
            activeDirectorId={active.directorId}
            onUpdate={onTranscriptUpdate}
          />
        )}
        <ActiveControls onEnd={onEnd} onReload={onReload} />
      </AvatarProvider>

      {/* Wings card — visible when there's a co director to switch to */}
      {wings && onSwitchToWings && (
        <WingsCard wings={wings} onSwitch={onSwitchToWings} />
      )}
    </div>
  );
}

// ----- Active tile -----

function ActiveTile({ label }: { label: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-neutral-950 ring-1 ring-neutral-900">
      <AvatarVideo className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute left-2 top-2 bg-neutral-900/90 px-1.5 py-0.5 font-mono text-[12px] uppercase tracking-[0.18em] text-white">
        {label}
      </div>
    </div>
  );
}

function TileSkeleton({ label }: { label: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-neutral-200 ring-1 ring-neutral-300">
      <div className="absolute left-2 top-2 bg-neutral-900/85 px-1.5 py-0.5 font-mono text-[12px] uppercase tracking-[0.18em] text-white">
        {label}
      </div>
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
      </div>
    </div>
  );
}

// ----- Wings card -----

function WingsCard({
  wings,
  onSwitch,
}: {
  wings: WidgetWingsParticipant;
  onSwitch: () => void;
}) {
  return (
    <button
      onClick={onSwitch}
      title={`Switch the call to ${wings.directorName}`}
      className="group flex w-full items-center gap-3 border-t border-neutral-200 bg-neutral-50/50 px-3 py-3 text-left hover:bg-neutral-900"
    >
      {/* Portrait — gives a face to the wings director so the user understands
          there's another person they can switch to. */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-neutral-300 bg-neutral-200 grayscale">
        {wings.portraitUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={wings.portraitUrl}
            alt={wings.directorName}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500 group-hover:text-neutral-300">
          In the wings · tap to switch
        </p>
        <p className="truncate font-serif text-[14px] leading-tight text-neutral-900 group-hover:text-white">
          {wings.directorName}
        </p>
        {wings.school && (
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400 group-hover:text-neutral-400">
            {wings.school}
          </p>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-1 border border-neutral-900 bg-white px-2.5 py-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-900 group-hover:border-white group-hover:bg-white">
        <ArrowLeftRight className="h-3 w-3" />
        Switch
      </span>
    </button>
  );
}

// ----- Active controls (mute, screenshare, reload, end) -----

function ActiveControls({
  onEnd,
  onReload,
}: {
  onEnd?: () => void;
  onReload?: () => void;
}) {
  const { isMicEnabled, toggleMic, isScreenShareEnabled, toggleScreenShare } =
    useLocalMedia();
  const session = useAvatarSession();

  return (
    // Icon-only control row. The widget panel is narrow (~380px); text
    // labels on 4 buttons with 12px-uppercase-0.18em-tracking burst the
    // container horizontally. Tooltips (title=) still announce intent.
    <div className="flex items-center justify-between gap-1 border-t border-neutral-200 px-2 py-2">
      <div className="flex items-center gap-1">
        <CtrlButton
          active={isMicEnabled === true}
          onClick={toggleMic}
          title={isMicEnabled ? "Mute mic" : "Unmute mic"}
          icon={
            isMicEnabled ? (
              <Mic className="h-4 w-4" />
            ) : (
              <MicOff className="h-4 w-4" />
            )
          }
        />
        <CtrlButton
          active={isScreenShareEnabled === true}
          onClick={toggleScreenShare}
          title={
            isScreenShareEnabled
              ? "Stop sharing screen"
              : "Share screen with the director"
          }
          icon={
            isScreenShareEnabled ? (
              <MonitorOff className="h-4 w-4" />
            ) : (
              <MonitorUp className="h-4 w-4" />
            )
          }
        />
      </div>
      <div className="flex items-center gap-1">
        {onReload && (
          <button
            onClick={async () => {
              try {
                await session.end();
              } catch {
                /* ignore — we're tearing down anyway */
              }
              onReload();
            }}
            title="Reload the call (use if the director went silent or the picture froze)"
            aria-label="Reload"
            className="flex items-center justify-center border border-neutral-300 bg-white p-2 text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => {
            session.end();
            onEnd?.();
          }}
          title="End call"
          aria-label="End call"
          className="flex items-center justify-center border border-neutral-300 bg-white p-2 text-neutral-700 transition hover:border-red-500 hover:text-red-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CtrlButton({
  active,
  onClick,
  title,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  /** Optional. When omitted the button is icon-only (used in the narrow
   *  avatar widget where 4 labeled buttons overflowed horizontally). */
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={label || title}
      className={cn(
        "flex items-center justify-center border transition",
        label
          ? "gap-1 px-2 py-1.5 font-mono text-[12px] uppercase tracking-[0.18em]"
          : "p-2",
        active
          ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800"
          : "border-neutral-300 bg-white text-neutral-500 hover:border-neutral-900 hover:text-neutral-900"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ----- Connection watchdog -----
//
// Sits inside <AvatarProvider> so it can call useAvatarSession(). Two
// behaviours:
//   1. If the session enters `error` state, surface a banner with a Reload
//      affordance.
//   2. If the session sits in `connecting` for more than 60s without
//      reaching `active`, suggest a reload.
// Auto-reload is intentionally NOT triggered — the user is on a live call,
// surprise re-connects mid-conversation are worse than a small banner.

function ConnectionWatch({ onReload }: { onReload?: () => void }) {
  const session = useAvatarSession();
  const [stuckAt, setStuckAt] = useState<number | null>(null);

  useEffect(() => {
    if (session.state === "connecting") {
      setStuckAt((prev) => prev ?? Date.now());
      return;
    }
    setStuckAt(null);
  }, [session.state]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (session.state !== "connecting") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session.state]);

  const stuck =
    session.state === "connecting" && stuckAt !== null && now - stuckAt > 60_000;

  if (session.state === "error") {
    return (
      <div className="border-t border-red-300 bg-red-50 px-3 py-2">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-red-700">
          Connection error
        </p>
        <p className="mt-1 line-clamp-2 font-mono text-[11px] leading-snug text-red-700">
          {session.error?.message || "The call dropped."}
        </p>
        {onReload && (
          <button
            onClick={onReload}
            className="mt-2 flex items-center gap-1 border border-red-700 bg-white px-2 py-1 font-mono text-[12px] uppercase tracking-[0.18em] text-red-700 hover:bg-red-700 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" />
            Reload the call
          </button>
        )}
      </div>
    );
  }

  if (stuck) {
    return (
      <div className="border-t border-amber-300 bg-amber-50 px-3 py-2">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-amber-700">
          Taking longer than usual
        </p>
        <p className="mt-1 font-mono text-[11px] leading-snug text-amber-800">
          Still connecting after 60s. The room may be stuck — reload to try again.
        </p>
        {onReload && (
          <button
            onClick={onReload}
            className="mt-2 flex items-center gap-1 border border-amber-700 bg-white px-2 py-1 font-mono text-[12px] uppercase tracking-[0.18em] text-amber-800 hover:bg-amber-700 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" />
            Reload
          </button>
        )}
      </div>
    );
  }

  return null;
}

// ----- TranscriptCapture -----
//
// Streams the active session's transcript up to the parent so it can be
// piped into the NEXT session (switch / reload) as "what was just said".
// Without this, the wings director walks in cold — they see what's on
// screen but not the conversation that led to it.

function TranscriptCapture({
  activeDirectorId,
  onUpdate,
}: {
  activeDirectorId: string;
  onUpdate: (
    transcript: Array<{ speaker: "user" | "director"; text: string }>
  ) => void;
}) {
  const transcript = useTranscript({ bufferSize: 50, interim: false });

  useEffect(() => {
    // Map participantIdentity → "user" | "director". Runway's avatar
    // participant identity contains "avatar"; user is anything else.
    const out = transcript
      .filter((t) => t.final)
      .map((t) => ({
        speaker:
          /avatar|director|agent|assistant/i.test(t.participantIdentity) ? "director" : "user",
        text: t.text.trim(),
      }))
      .filter((t) => t.text.length > 0) as Array<{
      speaker: "user" | "director";
      text: string;
    }>;
    onUpdate(out);
    // activeDirectorId is in deps so we reset when the active director swaps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, activeDirectorId]);

  return null;
}

// ----- ToolListener -----
//
// Wraps useClientEvent for any client_event tool. The args shape varies per
// tool — show_visual_example, cite_lesson, propose_*, commit_proposal, etc. —
// so the listener takes the raw JSON object and the caller narrows it.

function ToolListener({
  event,
  onInvoke,
}: {
  event: string;
  onInvoke: (args: Record<string, unknown> | null | undefined) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useClientEvent(event as any, ((args: unknown) =>
    onInvoke(
      args as Record<string, unknown> | null | undefined
    )) as never);
  return null;
}
