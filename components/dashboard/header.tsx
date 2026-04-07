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
import { useTranslation } from "@/lib/i18n/use-translations";
import { LogOut, Settings, User, Gem } from "lucide-react";
import { MobileMenuButton } from "./mobile-nav";

type HeaderProps = {
  userName?: string | null;
  credits?: number;
};

export function Header({ userName, credits = 0 }: HeaderProps) {
  const { t } = useTranslation();
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
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[#F0F0F0] bg-white px-4 md:px-6">
      {/* Left — hamburger + brand */}
      <div className="flex items-center gap-2">
        <MobileMenuButton />
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/logo.svg" alt="TwinLink" className="h-7 w-7 md:hidden" />
          <span className="text-[16px] font-bold text-[#1A1A1A] hidden md:inline">TwinLink</span>
        </Link>
      </div>

      {/* Right — credits + upgrade + avatar */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Credits */}
        <div className="flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-2.5 py-1.5 md:px-3">
          <Gem className="h-3.5 w-3.5 text-[#4D5D4B]" />
          <span className="text-[12px] md:text-[13px] font-bold text-[#1A1A1A] tabular-nums">
            {credits.toLocaleString()}
          </span>
        </div>

        {/* Upgrade — hidden on very small screens */}
        <Link
          href="/dashboard/billing"
          className="hidden sm:flex items-center rounded-full bg-[#4D5D4B] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#3d4a3b] transition-colors"
        >
          Upgrade
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center outline-none">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] text-[11px] font-bold text-white select-none hover:bg-[#333] transition-colors">
              {initials}
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48 bg-white shadow-elevated rounded-xl border border-[#F0F0F0]">
            {/* User info — non-interactive label */}
            <div className="px-3 py-2">
              <p className="text-[13px] font-semibold text-[#1A1A1A]">{userName || "Account"}</p>
              <p className="text-[11px] text-[#9CA3AF]">Free plan</p>
            </div>
            <DropdownMenuSeparator className="bg-[#F0F0F0]" />
            <DropdownMenuItem
              onClick={() => router.push("/dashboard/settings")}
              className="text-[#6B7280] focus:bg-[#F3F4F6] focus:text-[#1A1A1A] rounded-lg"
            >
              <Settings className="me-2 h-4 w-4" />
              {t.nav.settings}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/dashboard/brands")}
              className="text-[#6B7280] focus:bg-[#F3F4F6] focus:text-[#1A1A1A] rounded-lg"
            >
              <User className="me-2 h-4 w-4" />
              My Brands
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#F0F0F0]" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-[#6B7280] focus:bg-[#F3F4F6] focus:text-[#1A1A1A] rounded-lg"
            >
              <LogOut className="me-2 h-4 w-4" />
              {t.auth.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
