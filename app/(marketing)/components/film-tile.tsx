"use client";

import { motion } from "framer-motion";

type Props = {
  src?: string;
  poster?: string;
  label: string;
  title: string;
  meta?: string;
  aspect?: string;
  index?: number;
  className?: string;
};

export function FilmTile({
  src,
  poster,
  label,
  title,
  meta,
  aspect = "aspect-[4/5]",
  index = 0,
  className = "",
}: Props) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 }}
      className={`group relative ${className}`}
      data-cursor="play"
      data-cursor-label="Play"
    >
      {/* Outer clip-path mask: reveals from bottom to top as it enters view */}
      <motion.div
        initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
        whileInView={{ clipPath: "inset(0% 0% 0% 0%)" }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1], delay: index * 0.06 }}
        className={`relative w-full overflow-hidden bg-neutral-900 ${aspect}`}
      >
        {/* Fallback gradient */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,0.08), transparent 55%), linear-gradient(180deg, #111 0%, #000 100%)",
          }}
        />
        {poster && (
          <motion.img
            src={poster}
            alt=""
            initial={{ scale: 1.12 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 }}
            className="absolute inset-0 h-full w-full object-cover grayscale transition-transform duration-[1400ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-105"
          />
        )}
        {src && (
          <video
            src={src}
            poster={poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover grayscale transition-transform duration-[1400ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-105"
          />
        )}

        {/* Shine sweep on hover */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-[1200ms] ease-out group-hover:translate-x-full"
        />

        {/* Grain + vignette */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 40%, transparent 50%, rgba(0,0,0,0.45) 100%)",
          }}
        />

        {/* Top label */}
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/80">
            {label}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-white/60">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        {/* Bottom text with clip reveal */}
        <div className="absolute inset-x-5 bottom-5 overflow-hidden">
          <motion.div
            initial={{ y: "110%" }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 1,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.3 + index * 0.06,
            }}
          >
            <h3 className="font-serif text-[22px] leading-[1.05] text-white md:text-[28px]">
              {title}
            </h3>
            {meta && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
                {meta}
              </p>
            )}
          </motion.div>
        </div>

        {/* Hover stroke — animated inner border */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 border border-white/0 transition-colors duration-300 group-hover:border-white/30"
        />

        {/* Corner marks */}
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />
      </motion.div>
    </motion.figure>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const map = {
    tl: "top-2 left-2 border-t border-l",
    tr: "top-2 right-2 border-t border-r",
    bl: "bottom-2 left-2 border-b border-l",
    br: "bottom-2 right-2 border-b border-r",
  } as const;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute h-3 w-3 border-white/0 transition-colors duration-300 group-hover:border-white/60 ${map[pos]}`}
    />
  );
}
