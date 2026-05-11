"use client";

import { type ReactNode } from "react";

export function Marquee({
  children,
  speed = 40,
  className = "",
  reverse = false,
  fade = true,
  pauseOnHover = true,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
  reverse?: boolean;
  fade?: boolean;
  pauseOnHover?: boolean;
}) {
  return (
    <div
      className={`group relative overflow-hidden ${fade ? "marquee-container" : ""} ${className}`}
    >
      <div
        className={`flex min-w-max marquee-track ${pauseOnHover ? "group-hover:[animation-play-state:paused]" : ""}`}
        style={{
          ["--marquee-speed" as never]: `${speed}s`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
