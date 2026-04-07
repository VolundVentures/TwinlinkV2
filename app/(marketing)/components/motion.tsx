"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";
import {
  motion,
  useInView,
  useAnimation,
  useMotionValue,
  useTransform,
  animate,
  type Variants,
} from "framer-motion";

/* ─── Scroll-triggered reveal ─── */

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  once?: boolean;
  duration?: number;
}

const directionMap = {
  up: { y: 40, x: 0 },
  down: { y: -40, x: 0 },
  left: { x: 40, y: 0 },
  right: { x: -40, y: 0 },
  none: { x: 0, y: 0 },
};

export function Reveal({
  children,
  className,
  delay = 0,
  direction = "up",
  once = true,
  duration = 0.6,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-80px" });

  const d = directionMap[direction];

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, x: d.x, y: d.y }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: d.x, y: d.y }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.4, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Stagger container ─── */

interface StaggerProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: (stagger: number) => ({
    opacity: 1,
    transition: {
      staggerChildren: stagger,
      delayChildren: 0.1,
    },
  }),
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] },
  },
};

export function StaggerReveal({
  children,
  className,
  stagger = 0.08,
  delay = 0,
}: StaggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={staggerContainer}
      custom={stagger}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

/* ─── Animated counter ─── */

interface CounterProps {
  from?: number;
  to: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  decimals?: number;
}

export function AnimatedCounter({
  from = 0,
  to,
  duration = 2,
  suffix = "",
  prefix = "",
  className,
  decimals = 0,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const motionVal = useMotionValue(from);
  const rounded = useTransform(motionVal, (v) =>
    decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()
  );
  const [display, setDisplay] = useState(
    decimals > 0 ? from.toFixed(decimals) : from.toLocaleString()
  );

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(motionVal, to, {
      duration,
      ease: [0.25, 0.4, 0.25, 1],
    });
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [isInView, to, duration, motionVal, rounded]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* ─── Infinite marquee ─── */

interface MarqueeProps {
  children: ReactNode;
  speed?: number;
  className?: string;
  pauseOnHover?: boolean;
}

export function Marquee({
  children,
  speed = 30,
  className,
  pauseOnHover = true,
}: MarqueeProps) {
  return (
    <div
      className={`marquee-container overflow-hidden ${className ?? ""}`}
      style={{ ["--marquee-speed" as string]: `${speed}s` }}
    >
      <div
        className={`marquee-track flex w-max gap-12 ${
          pauseOnHover ? "hover:[animation-play-state:paused]" : ""
        }`}
      >
        {children}
        {children}
      </div>
    </div>
  );
}

/* ─── Text reveal (word by word) ─── */

interface TextRevealProps {
  text: string;
  className?: string;
  delay?: number;
}

export function TextReveal({ text, className, delay = 0 }: TextRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const words = text.split(" ");

  return (
    <span ref={ref} className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.3em]"
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.4,
            delay: delay + i * 0.04,
            ease: [0.25, 0.4, 0.25, 1],
          }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

/* ─── Floating animation ─── */

export function Float({
  children,
  className,
  amplitude = 8,
  duration = 4,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  amplitude?: number;
  duration?: number;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      animate={{ y: [-amplitude, amplitude, -amplitude] }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}
