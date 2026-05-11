"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "lucide-react";

const NAV = [
  { label: "Cast", href: "#cast" },
  { label: "Reel", href: "#reel" },
  { label: "Method", href: "#method" },
  { label: "Pricing", href: "#pricing" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function click(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (href.startsWith("#")) {
      e.preventDefault();
      setMobileOpen(false);
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const onDark = !scrolled; // hero is dark, switch nav colors

  return (
    <>
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          scrolled
            ? "border-b border-neutral-200 bg-white/85 backdrop-blur-xl"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-baseline gap-2">
            <span
              className={cn(
                "font-serif text-[22px] tracking-tight transition-colors",
                onDark ? "text-white" : "text-neutral-900"
              )}
            >
              TwinLink
            </span>
            <span
              className={cn(
                "font-mono text-[9px] uppercase tracking-[0.24em] transition-colors",
                onDark ? "text-white/50" : "text-neutral-400"
              )}
            >
              director
            </span>
          </Link>

          <div className="hidden items-center gap-10 md:flex">
            {NAV.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => click(e, item.href)}
                className={cn(
                  "group relative font-mono text-[10px] uppercase tracking-[0.24em] transition-colors",
                  onDark
                    ? "text-white/70 hover:text-white"
                    : "text-neutral-500 hover:text-neutral-900"
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute -bottom-1 left-0 block h-px w-0 transition-all duration-300 group-hover:w-full",
                    onDark ? "bg-white" : "bg-neutral-900"
                  )}
                />
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-6 md:flex">
            <Link
              href="/login"
              className={cn(
                "inline-flex h-10 items-center px-5 font-mono text-[10px] uppercase tracking-[0.24em] transition-colors",
                onDark
                  ? "bg-white text-neutral-900 hover:bg-neutral-200"
                  : "bg-neutral-900 text-white hover:bg-neutral-800"
              )}
            >
              Sign in
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={cn(
              "flex h-10 w-10 items-center justify-center transition-colors md:hidden",
              onDark ? "text-white" : "text-neutral-900"
            )}
            aria-label="Menu"
          >
            {mobileOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 flex flex-col bg-neutral-950 px-6 pt-24 text-white md:hidden"
          >
            <div className="flex flex-col">
              {NAV.map((item, i) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => click(e, item.href)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  className="border-b border-white/10 py-6 font-serif text-[40px] leading-none tracking-tight text-white"
                >
                  {item.label}
                </motion.a>
              ))}
            </div>
            <div className="mt-10 flex flex-col gap-3">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex h-14 items-center justify-center bg-white font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-900"
              >
                Sign in
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
