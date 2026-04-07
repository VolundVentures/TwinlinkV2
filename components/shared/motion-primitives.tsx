"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import {
  fadeIn,
  fadeInUp,
  scaleIn,
  staggerContainer,
  staggerItem,
  slideInRight,
  slideInLeft,
} from "@/lib/motion";

/* ────── Fade In ────── */
export function FadeIn({
  children,
  className,
  delay = 0,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ────── Fade In Up ────── */
export function FadeInUp({
  children,
  className,
  delay = 0,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ────── Scale In ────── */
export function ScaleIn({
  children,
  className,
  delay = 0,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ────── Stagger Grid ────── */
export function StaggerGrid({
  children,
  className,
  ...props
}: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...props
}: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={staggerItem} className={className} {...props}>
      {children}
    </motion.div>
  );
}

/* ────── Page Transition Wrapper ────── */
export function PageTransition({
  children,
  className,
  direction = "right",
}: {
  children: React.ReactNode;
  className?: string;
  direction?: "right" | "left";
}) {
  const variants = direction === "right" ? slideInRight : slideInLeft;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* ────── Animated Presence Helper ────── */
export { motion, AnimatePresence };
