"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings } from "lucide-react";
import { MobileMenuButton } from "./mobile-nav";

type HeaderProps = {
  userName?: string | null;
  credits?: number;
};

export function Header({ userName, credits = 0 }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-5 md:px-6">
      <div className="flex items-center gap-3">
        <MobileMenuButton />
        <Link href="/dashboard" className="flex items-center md:hidden">
          <span className="font-serif text-[18px] text-neutral-900">TwinLink</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Credits */}
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-neutral-500">
            credits
          </span>
          <span className="font-serif text-[15px] text-neutral-900 tabular-nums">
            {credits.toLocaleString()}
          </span>
        </div>

        {/* Upgrade */}
        <Link
          href="/dashboard/settings"
          className="hidden sm:inline-flex h-8 items-center rounded-none border border-neutral-900 bg-neutral-900 px-4 text-[12px] uppercase tracking-[0.18em] text-white transition-colors hover:bg-neutral-800"
        >
          Upgrade
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center outline-none">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white select-none hover:bg-neutral-800 transition-colors">
              {initials}
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-48 rounded-none border border-neutral-200 bg-white shadow-sm"
          >
            <div className="px-3 py-2">
              <p className="font-serif text-[13px] text-neutral-900">{userName || "Account"}</p>
              <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                Free plan
              </p>
            </div>
            <DropdownMenuSeparator className="bg-neutral-200" />
            <DropdownMenuItem
              onClick={() => router.push("/dashboard/settings")}
              className="rounded-none text-neutral-700 focus:bg-neutral-100 focus:text-neutral-900"
            >
              <Settings className="me-2 h-4 w-4" />
              <span className="font-mono text-[12px] uppercase tracking-[0.16em]">Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-neutral-200" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="rounded-none text-neutral-700 focus:bg-neutral-100 focus:text-neutral-900"
            >
              <LogOut className="me-2 h-4 w-4" />
              <span className="font-mono text-[12px] uppercase tracking-[0.16em]">Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
