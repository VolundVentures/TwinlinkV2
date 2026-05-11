"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MenuIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Director", href: "/dashboard/director" },
  { label: "Gallery", href: "/dashboard/generations" },
  { label: "Assets", href: "/dashboard/assets" },
  { label: "Settings", href: "/dashboard/settings" },
];

const BOTTOM_TABS = [
  { label: "Director", href: "/dashboard/director" },
  { label: "Gallery", href: "/dashboard/generations" },
  { label: "Assets", href: "/dashboard/assets" },
];

export function MobileMenuButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="flex md:hidden h-9 w-9 items-center justify-center rounded-none text-neutral-700 hover:bg-neutral-100"
        aria-label="Toggle menu"
      >
        {open ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-white md:hidden"
            style={{ top: "64px" }}
          >
            <nav className="flex flex-col gap-0.5 p-4">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-sm px-4 py-3",
                      active
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                    )}
                  >
                    <span className="font-mono text-[12px] uppercase tracking-[0.16em]">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-around border-t border-neutral-200 bg-white/95 backdrop-blur-md px-2 py-2">
      {BOTTOM_TABS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 min-w-[60px]",
              active ? "text-neutral-900" : "text-neutral-400"
            )}
          >
            <span
              className={cn(
                "h-1 w-1 rounded-full",
                active ? "bg-neutral-900" : "bg-neutral-300"
              )}
            />
            <span className="font-mono text-[12px] uppercase tracking-[0.18em]">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
