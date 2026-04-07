"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "lucide-react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (href.startsWith("#")) {
      e.preventDefault();
      setMobileOpen(false);
      const el = document.querySelector(href);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-white/80 backdrop-blur-xl border-b border-black/5 shadow-sm"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="TwinLink" className="h-8 w-8" />
            <span className="text-xl font-bold tracking-tight text-black">
              TwinLink
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="text-sm text-black/50 hover:text-black transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login">
              <button className="text-sm text-black/60 hover:text-black transition-colors px-4 py-2">
                Log in
              </button>
            </Link>
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="rounded-full bg-[#4F6247] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#3d4a3b] transition-colors"
              >
                Get started
              </motion.button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex md:hidden h-10 w-10 items-center justify-center rounded-lg text-black/60 hover:text-black hover:bg-black/[0.03] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <XIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-white flex flex-col pt-20 px-6"
          >
            <div className="flex flex-col gap-1 mt-4">
              {navLinks.map((item, i) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="py-4 text-[18px] font-medium text-black/70 hover:text-black border-b border-black/[0.05] transition-colors"
                >
                  {item.label}
                </motion.a>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <Link href="/signup" onClick={() => setMobileOpen(false)}>
                <button className="w-full rounded-full bg-[#4F6247] text-white text-[15px] font-medium py-3.5 hover:bg-[#3d4a3b] transition-colors">
                  Get started
                </button>
              </Link>
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <button className="w-full rounded-full border border-black/10 text-[15px] font-medium py-3.5 text-black/60 hover:text-black transition-colors">
                  Log in
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
