"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";

type Panel = {
  label: string;
  title: string;
  body: string;
  meta: string;
  video?: string;
  poster?: string;
  tint?: string;
};

export function HorizontalGallery({ panels }: { panels: Panel[] }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Each panel is 100vw; track is panels.length * 100vw.
  // Translate from 0 to -(panels.length - 1) * 100vw.
  const travel = -(panels.length - 1) * 100;
  const x = useTransform(scrollYProgress, [0, 1], ["0vw", `${travel}vw`]);
  const progress = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section
      ref={ref}
      id="inside"
      className="relative bg-neutral-950 text-white"
      style={{ height: `${panels.length * 100}vh` }}
    >
      <div className="sticky top-0 flex h-screen w-full flex-col overflow-hidden">
        {/* Header overlay */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-6 pt-24 md:pt-28">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/50">
              [03.5] Inside the studio
            </p>
            <p className="mt-3 font-serif text-[28px] italic leading-none tracking-tight text-white md:text-[40px]">
              Scroll →
            </p>
          </div>
          <div className="text-right">
            <ProgressIndicator progress={progress} total={panels.length} />
          </div>
        </div>

        {/* Track */}
        <motion.div
          style={{
            ...(reduce ? {} : { x }),
            width: `${panels.length * 100}vw`,
          }}
          className="flex h-full"
          aria-label="Horizontal gallery of the studio"
        >
          {panels.map((p, i) => (
            <Panel key={p.title} panel={p} index={i} total={panels.length} />
          ))}
        </motion.div>

        {/* Bottom rail */}
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex items-center justify-between px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40">
            Keep scrolling
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40">
            TwinLink Studio
          </span>
        </div>
      </div>
    </section>
  );
}

function ProgressIndicator({
  progress,
  total,
}: {
  progress: MotionValue<number>;
  total: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-baseline font-mono text-[10px] tabular-nums uppercase tracking-[0.24em] text-white/60">
        <IndexFromProgress progress={progress} total={total} />
        <span className="mx-1 text-white/30">/</span>
        <span>{String(total).padStart(2, "0")}</span>
      </span>
      <div className="relative h-px w-24 overflow-hidden bg-white/20">
        <motion.div
          style={{ scaleX: progress }}
          className="absolute inset-0 origin-left bg-white"
        />
      </div>
    </div>
  );
}

function IndexFromProgress({
  progress,
  total,
}: {
  progress: MotionValue<number>;
  total: number;
}) {
  const idx = useTransform(progress, (v) =>
    String(Math.min(total, Math.max(1, Math.floor(v * total) + 1))).padStart(2, "0")
  );
  return <motion.span>{idx as unknown as string}</motion.span>;
}

function Panel({
  panel,
  index,
  total,
}: {
  panel: Panel;
  index: number;
  total: number;
}) {
  return (
    <div
      className="relative flex h-full w-screen shrink-0 items-center justify-center px-8 md:px-20"
    >
      {/* Panel media */}
      <div className="relative flex h-full w-full max-w-6xl items-center">
        <div className="grid w-full grid-cols-1 items-center gap-10 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-7">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    panel.tint ||
                    "radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,0.10), transparent 55%), linear-gradient(180deg, #1a1a1a 0%, #000 100%)",
                }}
              />
              {panel.poster && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={panel.poster}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover grayscale"
                />
              )}
              {panel.video && (
                <video
                  src={panel.video}
                  poster={panel.poster}
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload="none"
                  className="absolute inset-0 h-full w-full object-cover grayscale"
                />
              )}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(120% 90% at 50% 40%, transparent 50%, rgba(0,0,0,0.55) 100%)",
                }}
              />
              <div className="absolute left-5 top-5 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-dot" />
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/70">
                  {panel.meta}
                </span>
              </div>
              <div className="absolute right-5 top-5 font-mono text-[10px] tabular-nums text-white/50">
                {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
              </div>
            </div>
          </div>

          <div className="md:col-span-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
              {panel.label}
            </p>
            <h3 className="mt-5 font-serif text-[40px] leading-[1.05] tracking-tight md:text-[64px]">
              {panel.title}
            </h3>
            <p className="mt-6 max-w-md font-serif text-[16px] leading-[1.7] text-white/70">
              {panel.body}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
