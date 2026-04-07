"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { label: "Integrate", href: "/dashboard/integrations", icon: Plug },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex h-full w-[72px] flex-col items-center border-r border-[#F0F0F0] bg-white py-4">
      {/* Logo */}
      <Link href="/dashboard" className="mb-5 flex items-center justify-center">
        <img src="/logo.svg" alt="TwinLink" className="h-8 w-8" />
      </Link>

      {/* Main nav */}
      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all duration-150",
                active
                  ? "bg-[#4D5D4B] text-white"
                  : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A1A]"
              )}
              title={item.label}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
              <span className={cn(
                "mt-1 text-[10px] font-semibold leading-none",
                active ? "text-white" : "text-[#6B7280] group-hover:text-[#1A1A1A]"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="flex flex-col items-center gap-1.5 mb-2">
        {BOTTOM_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all duration-150",
                active
                  ? "bg-[#4D5D4B] text-white"
                  : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A1A]"
              )}
              title={item.label}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
              <span className={cn(
                "mt-1 text-[10px] font-semibold leading-none",
                active ? "text-white" : "text-[#6B7280]"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
