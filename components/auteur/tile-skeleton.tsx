"use client";

// Skeleton tile for the avatar column.
//
// Used as the AvatarProvider `fallback` so the column has a stable three-slot
// layout during the ~30-60s connection phase. Without this, AvatarProvider
// renders null while loading and the column collapses around whichever
// session connected first.

export function TileSkeleton({
  className,
  label,
  sublabel,
}: {
  className?: string;
  label: string;
  sublabel?: string;
}) {
  return (
    <div
      className={[
        "relative aspect-video w-full overflow-hidden bg-neutral-200 ring-1 ring-neutral-300",
        "animate-pulse",
        className ?? "",
      ].join(" ")}
    >
      <div className="absolute left-2 top-2 bg-neutral-900/85 px-2 py-1 font-mono text-[12px] uppercase tracking-[0.18em] text-white">
        {label}
      </div>
      <div className="flex h-full items-center justify-center">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
          {sublabel ?? "Connecting…"}
        </p>
      </div>
    </div>
  );
}
