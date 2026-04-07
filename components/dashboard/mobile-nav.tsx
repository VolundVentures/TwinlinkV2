"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  CalendarDays,
  BarChart3,
  SmilePlus,
  Pencil,
  Plug,
  Rocket,
  LayoutGrid,
  Home,
  Settings,
  FolderOpen,
  MenuIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", href: "/dashboard", icon: Home, exact: true },
  { label: "Chat", href: "/dashboard/generate", icon: Sparkles },
  { label: "Director", href: "/dashboard/campaigns", icon: Rocket },
  { label: "Gallery", href: "/dashboard/generations", icon: LayoutGrid },
  { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
  { label: "Compete", href: "/dashboard/competitors", icon: BarChart3 },
  { label: "Assets", href: "/dashboard/assets", icon: FolderOpen },
  { label: "Avatars", href: "/dashboard/characters", icon: SmilePlus },
  { label: "Brands", href: "/dashboard/brands", icon: Pencil },
];

const BOTTOM_ITEMS = [
  { label: "Integrations", href: "/dashboard/integrations", icon: Plug },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

/* ── Bottom tab bar for quick access on mobile ── */
const BOTTOM_TABS = [
  { label: "Home", href: "/dashboard", icon: Home, exact: true },
  { label: "Chat", href: "/dashboard/generate", icon: Sparkles },
  { label: "Gallery", href: "/dashboard/generations", icon: LayoutGrid },
  { label: "Director", href: "/dashboard/campaigns", icon: Rocket },
];

export function MobileMenuButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll
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

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F3F4F6] transition-colors"
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
            style={{ top: "56px" }}
          >
            <div className="flex flex-col h-full overflow-y-auto pb-20">
              <nav className="flex flex-col gap-1 p-4">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.href, item.exact);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                        active
                          ? "bg-[#4D5D4B] text-white"
                          : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A1A]"
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
                      <span className="text-[15px] font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-[#F0F0F0] mx-4" />

              <nav className="flex flex-col gap-1 p-4">
                {BOTTOM_ITEMS.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                        active
                          ? "bg-[#4D5D4B] text-white"
                          : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A1A]"
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
                      <span className="text-[15px] font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Bottom tab bar ── */
export function MobileBottomNav() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-around border-t border-[#F0F0F0] bg-white/95 backdrop-blur-md px-2 py-1 safe-area-bottom">
      {BOTTOM_TABS.map((item) => {
        const active = isActive(item.href, item.exact);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
              active ? "text-[#4D5D4B]" : "text-[#9CA3AF]"
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.6} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
