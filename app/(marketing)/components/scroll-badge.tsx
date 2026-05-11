"use client";

import { motion } from "framer-motion";

// Rotating circular text badge — "SCROLL · SCROLL · SCROLL"
export function ScrollBadge({
  text = "SCROLL · SCROLL · SCROLL · SCROLL · ",
  size = 120,
  className = "",
}: {
  text?: string;
  size?: number;
  className?: string;
}) {
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const chars = text.split("");
  return (
    <motion.div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <path
            id="scroll-circle"
            d={`M ${size / 2}, ${size / 2} m -${r}, 0 a ${r},${r} 0 1,1 ${r * 2},0 a ${r},${r} 0 1,1 -${r * 2},0`}
          />
        </defs>
        <text className="fill-white font-mono" style={{ fontSize: 10, letterSpacing: "0.3em" }}>
          <textPath href="#scroll-circle" startOffset="0">
            {chars.join("")}
          </textPath>
        </text>
      </svg>
      {/* Center arrow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </span>
      </div>
      <span className="sr-only">Scroll</span>
      {/* Suppress unused var */}
      <span hidden>{c}</span>
    </motion.div>
  );
}
