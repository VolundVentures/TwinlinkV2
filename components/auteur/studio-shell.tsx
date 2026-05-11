"use client";

// StudioShell — the layout for the live director session.
//
// Three regions arranged within the existing dashboard chrome (which provides
// top bar + left nav). Inside this shell:
//
//   ┌─────────────────────────┬───────────────┐
//   │                         │  Lead         │
//   │  WORKSPACE (top)        │  Co           │
//   │                         │  You          │
//   ├─────────────────────────┤  + Mute / End │
//   │  WHITEBOARD (bottom)    │               │
//   │                         │               │
//   └─────────────────────────┴───────────────┘
//
// Two AvatarProviders wrap the column:
//   - Lead AP wraps both the Lead's DirectorTile AND the UserTile (so
//     useLocalMedia / UserVideo work inside its session context).
//   - Co AP wraps the Co's DirectorTile.
// AvatarProvider renders a React Fragment, so the column is a flat flex of
// tiles. We use Tailwind `order-*` to put User visually after Co.

import { useCallback, useState } from "react";
import { AvatarProvider, useClientEvent } from "@runwayml/avatars-react";
import "@runwayml/avatars-react/styles.css";

import { DirectorTile, UserTile } from "./avatar-tile";
import { Whiteboard, type WhiteboardCard } from "./whiteboard";

export type StudioParticipant = {
  directorId: string;
  directorName: string;
  avatarId: string;
  sessionId: string;
  sessionKey: string;
};

export type StudioShellProps = {
  lead: StudioParticipant;
  co: StudioParticipant | null;
  onEnd?: () => void;
};

export function StudioShell({ lead, co, onEnd }: StudioShellProps) {
  const [cards, setCards] = useState<WhiteboardCard[]>([]);
  const [drawing, setDrawing] = useState(false);

  // Each tool invocation from a director hits this handler. We round-trip
  // through /api/whiteboard/generate to render the actual image, then add
  // a card to the whiteboard. Newest card on the left.
  const handleVisualExample = useCallback(
    async (
      args: { description?: string; caption?: string } | null | undefined,
      meta: { directorId: string; directorName: string }
    ) => {
      if (!args?.description || !args?.caption) return;
      setDrawing(true);
      try {
        const res = await fetch("/api/whiteboard/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            directorId: meta.directorId,
            description: args.description,
            caption: args.caption,
          }),
        });
        if (!res.ok) {
          console.error("[whiteboard] generate failed:", res.status, await res.text());
          return;
        }
        const data = (await res.json()) as {
          url: string;
          caption: string;
          directorId: string;
          directorName: string;
        };
        setCards((cur) => [
          {
            id: crypto.randomUUID(),
            url: data.url,
            caption: data.caption,
            directorId: data.directorId,
            directorName: data.directorName,
            createdAt: Date.now(),
          },
          ...cur,
        ]);
      } catch (err) {
        console.error("[whiteboard] error:", err);
      } finally {
        setDrawing(false);
      }
    },
    []
  );

  return (
    <div className="grid h-[calc(100vh-4rem)] w-full grid-cols-[1fr_minmax(320px,28%)] gap-3 bg-white p-3">
      {/* Center column: workspace (top) + whiteboard (bottom) */}
      <div className="grid min-h-0 grid-rows-[1fr_minmax(220px,40%)] gap-3 overflow-hidden">
        <Workspace lead={lead} co={co} />
        <Whiteboard cards={cards} loading={drawing} />
      </div>

      {/* Right column: stacked tiles. Two AvatarProviders, three visible tiles. */}
      <div className="flex flex-col gap-3 overflow-y-auto">
        <AvatarProvider
          avatarId={lead.avatarId}
          sessionId={lead.sessionId}
          sessionKey={lead.sessionKey}
          audio
          video
        >
          <DirectorTile
            className="order-1"
            label={`Lead · ${lead.directorName}`}
          />
          <UserTile className="order-3" onEnd={onEnd} />
          <ToolListener
            event="show_visual_example"
            onInvoke={(args) =>
              handleVisualExample(args, {
                directorId: lead.directorId,
                directorName: lead.directorName,
              })
            }
          />
        </AvatarProvider>

        {co && (
          <AvatarProvider
            avatarId={co.avatarId}
            sessionId={co.sessionId}
            sessionKey={co.sessionKey}
            audio
            video
          >
            <DirectorTile
              className="order-2"
              label={`Co · ${co.directorName}`}
            />
            <ToolListener
              event="show_visual_example"
              onInvoke={(args) =>
                handleVisualExample(args, {
                  directorId: co.directorId,
                  directorName: co.directorName,
                })
              }
            />
          </AvatarProvider>
        )}
      </div>
    </div>
  );
}

// ToolListener — sits inside an AvatarProvider and forwards client-event
// invocations to the parent. Lives as a child so it can use the SDK hook.
function ToolListener({
  event,
  onInvoke,
}: {
  event: string;
  onInvoke: (args: { description?: string; caption?: string } | null | undefined) => void;
}) {
  // useClientEvent registers a handler scoped to the parent AvatarProvider.
  // The SDK's typing wants a literal tool name; cast to satisfy.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useClientEvent(event as any, ((args: unknown) =>
    onInvoke(args as { description?: string; caption?: string })) as never);
  return null;
}

// ---- Workspace placeholder ----

function Workspace({ lead, co }: { lead: StudioParticipant; co: StudioParticipant | null }) {
  return (
    <div className="flex flex-col overflow-hidden border border-neutral-200 bg-neutral-50">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
        <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-neutral-500">
          Workspace
        </p>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-400">
          {co ? `${lead.directorName} + ${co.directorName}` : lead.directorName}
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-md">
          <p className="font-serif text-2xl leading-snug text-neutral-900">
            Tell them what you want to make.
          </p>
          <p className="mt-3 font-mono text-xs leading-relaxed text-neutral-500">
            The directors are listening. Speak the first detail you remember
            about the story — they&apos;ll ask the rest. Anything they want to
            show you appears on the whiteboard below.
          </p>
        </div>
      </div>
    </div>
  );
}
