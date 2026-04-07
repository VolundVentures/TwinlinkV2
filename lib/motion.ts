/**
 * TwinLink — Shared framer-motion presets
 * Physics-based springs for premium, interruptible animations.
 */

import type { Transition, Variants } from "framer-motion";

/* ────── Spring presets ────── */

export const spring = {
  /** Buttons, tooltips, micro-interactions */
  snappy: { type: "spring", stiffness: 500, damping: 30 } as Transition,
  /** Page transitions, card entrances */
  smooth: { type: "spring", stiffness: 300, damping: 25 } as Transition,
  /** Layout shifts, masonry reflow */
  gentle: { type: "spring", stiffness: 200, damping: 20 } as Transition,
  /** Popover / floating card */
  popover: { type: "spring", stiffness: 400, damping: 28 } as Transition,
};

/* ────── Variant sets ────── */

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: spring.smooth },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: spring.smooth },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: spring.snappy },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: spring.smooth },
  exit: { opacity: 0, x: -40, transition: spring.smooth },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: spring.smooth },
  exit: { opacity: 0, x: 40, transition: spring.smooth },
};

/* ────── Stagger container ────── */

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: spring.gentle },
};

/* ────── Hover presets (for whileHover / whileTap) ────── */

export const hoverLift = {
  whileHover: { y: -2, transition: spring.snappy },
  whileTap: { scale: 0.98, transition: spring.snappy },
};

export const hoverScale = {
  whileHover: { scale: 1.02, transition: spring.snappy },
  whileTap: { scale: 0.98, transition: spring.snappy },
};

export const hoverGlow = {
  whileHover: { boxShadow: "0 8px 32px rgba(22,21,20,0.08)", transition: spring.snappy },
};
