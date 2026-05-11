"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";

type CursorMode = "default" | "hover" | "play" | "drag";

export function Cursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, { stiffness: 500, damping: 40, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 500, damping: 40, mass: 0.4 });

  const [mode, setMode] = useState<CursorMode>("default");
  const [label, setLabel] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(pointer: fine)").matches
      : false
  );

  useEffect(() => {
    const mm = window.matchMedia("(pointer: fine)");
    const onChange = () => setEnabled(mm.matches);
    mm.addEventListener?.("change", onChange);
    return () => mm.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    function onMove(e: MouseEvent) {
      x.set(e.clientX);
      y.set(e.clientY);
    }
    function onOver(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const el = t.closest("[data-cursor]") as HTMLElement | null;
      if (el) {
        const m = (el.dataset.cursor as CursorMode) || "hover";
        setMode(m);
        setLabel(el.dataset.cursorLabel || "");
      } else if (t.closest("a, button, [role=button]")) {
        setMode("hover");
        setLabel("");
      } else {
        setMode("default");
        setLabel("");
      }
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  const big = mode !== "default";
  const showLabel = (mode === "play" || mode === "drag") && label;

  return (
    <>
      <style>{`html, body { cursor: none; } a, button, [role=button] { cursor: none !important; }`}</style>
      {/* Trailing ring */}
      <motion.div
        aria-hidden
        style={{ x: springX, y: springY }}
        className="pointer-events-none fixed left-0 top-0 z-[9999] -translate-x-1/2 -translate-y-1/2 mix-blend-difference"
      >
        <motion.div
          animate={{
            width: big ? 72 : 28,
            height: big ? 72 : 28,
            borderWidth: big ? 0 : 1,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="flex items-center justify-center rounded-full border-white bg-white/10 backdrop-blur-sm"
        >
          <AnimatePresence mode="wait">
            {showLabel ? (
              <motion.span
                key={label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="font-mono text-[9px] uppercase tracking-[0.2em] text-white"
              >
                {label}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Leading dot */}
      <motion.div
        aria-hidden
        style={{ x, y }}
        className="pointer-events-none fixed left-0 top-0 z-[9999] h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white mix-blend-difference"
      />
    </>
  );
}
