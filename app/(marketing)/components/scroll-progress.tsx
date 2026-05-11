"use client";

import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const w = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 40,
    restDelta: 0.001,
  });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX: w }}
      className="fixed left-0 top-0 z-[60] h-[2px] w-full origin-left bg-neutral-900 mix-blend-difference"
    />
  );
}
