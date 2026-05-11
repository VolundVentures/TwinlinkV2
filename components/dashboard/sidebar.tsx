"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Director", href: "/dashboard/director" },
  { label: "Gallery", href: "/dashboard/generations" },
  { label: "Assets", href: "/dashboard/assets" },
  { label: "Scene Builder", href: "/dashboard/scene-builder" },
];

const BOTTOM_ITEMS = [{ label: "Settings", href: "/dashboard/settings" }];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex h-full w-[220px] flex-col border-r border-neutral-200 bg-white">
      {/* Wordmark */}
      <Link
        href="/dashboard"
        className="flex h-16 items-center border-b border-neutral-200 px-6"
      >
        <span className="font-serif text-[20px] tracking-tight text-neutral-900">TwinLink</span>
        <span className="ml-1.5 text-[12px] uppercase tracking-[0.18em] text-neutral-400">
          director
        </span>
      </Link>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-5">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-sm px-3 py-2 text-[13px] transition-colors",
                    active
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                  )}
                >
                  <span
                    className={cn(
                      "h-1 w-1 rounded-full transition-colors",
                      active ? "bg-white" : "bg-neutral-400 group-hover:bg-neutral-700"
                    )}
                  />
                  <span className="font-mono text-[12px] uppercase tracking-[0.16em]">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom */}
      <div className="border-t border-neutral-200 px-3 py-3">
        <ul className="space-y-0.5">
          {BOTTOM_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-[13px]",
                    active
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  )}
                >
                  <span
                    className={cn(
                      "h-1 w-1 rounded-full",
                      active ? "bg-white" : "bg-neutral-400"
                    )}
                  />
                  <span className="font-mono text-[12px] uppercase tracking-[0.16em]">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
