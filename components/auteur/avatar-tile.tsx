"use client";

// Director and User tiles for the avatar column.
//
// Both must be rendered inside an AvatarProvider context (the parent supplies
// the session). They render only the visual tile + label; no LiveKit setup.
//
// AvatarProvider renders a React Fragment (no wrapper div), so multiple tiles
// share the column's flex layout as siblings. We use Tailwind's `order-*`
// utility on each tile to control visual stacking when tiles from different
// providers are mixed.

import { AvatarVideo, UserVideo, useAvatarSession, useLocalMedia } from "@runwayml/avatars-react";

type TileBaseProps = {
  /** Tailwind class for flex order, so the column can stack tiles regardless of which provider renders them. */
  className?: string;
};

/**
 * Director tile — renders the AvatarVideo for whichever AvatarProvider this
 * tile lives inside. The label is visual-only; doesn't drive any logic.
 */
export function DirectorTile({
  label,
  active,
  className,
}: TileBaseProps & {
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={[
        "relative aspect-video w-full overflow-hidden bg-neutral-950",
        active ? "ring-2 ring-neutral-100" : "ring-1 ring-neutral-800",
        "transition-shadow duration-300",
        className ?? "",
      ].join(" ")}
    >
      <AvatarVideo className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute left-2 top-2 bg-neutral-900/85 px-2 py-1 font-mono text-[12px] uppercase tracking-[0.18em] text-white">
        {label}
      </div>
    </div>
  );
}

/**
 * User tile — webcam preview + mute/end controls. Must live inside an
 * AvatarProvider so useLocalMedia can read the local mic state.
 */
export function UserTile({
  className,
  onEnd,
}: TileBaseProps & {
  onEnd?: () => void;
}) {
  const { state, end } = useAvatarSession();
  const { isMicEnabled, toggleMic } = useLocalMedia();

  return (
    <div className={["flex flex-col gap-1", className ?? ""].join(" ")}>
      <div className="relative aspect-video w-full overflow-hidden bg-black ring-1 ring-neutral-800">
        <UserVideo className="absolute inset-0 h-full w-full object-cover" />
        <div className="pointer-events-none absolute left-2 top-2 bg-neutral-900/85 px-2 py-1 font-mono text-[12px] uppercase tracking-[0.18em] text-white">
          You
        </div>
      </div>
      <div className="flex items-center justify-between gap-1 pt-1">
        <div className="flex gap-1">
          <button
            onClick={toggleMic}
            className="border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-700"
          >
            {isMicEnabled ? "Mute" : "Unmute"}
          </button>
          <button
            onClick={() => {
              end();
              onEnd?.();
            }}
            className="border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-[12px] uppercase tracking-[0.18em] text-white hover:bg-neutral-700"
          >
            End
          </button>
        </div>
        <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
          {state}
        </span>
      </div>
    </div>
  );
}
