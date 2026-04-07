"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2,
  Check,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translations";
import type { Locale } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase/client";

const LANGUAGES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
];

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

export default function SettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const [credits, setCredits] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [connectedCount, setConnectedCount] = useState<number>(0);

  useEffect(() => {
    async function fetchUser() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setUserName(
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            null
          );
          setUserEmail(user.email || null);
        }
      } catch {
        /* keep defaults */
      }
    }

    async function fetchCredits() {
      try {
        const res = await fetch("/api/credits");
        if (!res.ok) throw new Error("Failed to fetch credits");
        const data = await res.json();
        setCredits(data.balance ?? 0);
      } catch {
        setCredits(null);
      } finally {
        setLoadingCredits(false);
      }
    }

    async function fetchConnections() {
      try {
        const res = await fetch("/api/integrations/connections");
        if (res.ok) {
          const data = await res.json();
          setConnectedCount((data.connections ?? []).length);
        }
      } catch {
        /* keep 0 */
      }
    }

    fetchUser();
    fetchCredits();
    fetchConnections();
  }, []);

  const initials = getInitials(userName, userEmail);

  return (
    <div className="mx-auto max-w-2xl px-8 py-6 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-[32px] font-bold text-[#1A1A1A] leading-tight">
          {t.nav.settings}
        </h1>
        <p className="mt-1 text-[15px] text-[#6B7280]">
          Manage your account, preferences, and billing.
        </p>
      </div>

      {/* -- Profile Section -- */}
      <section className="rounded-2xl border border-[#F0F0F0] bg-white p-6">
        <h2 className="text-[14px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-5">
          Profile
        </h2>

        {/* Avatar + identity */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1A1A1A] text-white text-[20px] font-bold select-none">
            {initials}
          </div>
          <div>
            <p className="text-[18px] font-bold text-[#1A1A1A] leading-tight">
              {userName || "Your Profile"}
            </p>
            <p className="text-[14px] text-[#6B7280] mt-0.5">
              {userEmail || "Managed through your authentication provider"}
            </p>
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          {/* Name field */}
          <div className="space-y-1.5">
            <label className="block text-[14px] font-semibold text-[#1A1A1A]">
              {t.auth.fullName}
            </label>
            <div className="flex h-12 items-center rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 text-[15px] text-[#6B7280]">
              {userName || "Not set"}
            </div>
          </div>

          {/* Email field */}
          <div className="space-y-1.5">
            <label className="block text-[14px] font-semibold text-[#1A1A1A]">
              {t.auth.email}
            </label>
            <div className="flex h-12 items-center rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 text-[15px] text-[#6B7280]">
              {userEmail || "Not set"}
            </div>
          </div>
        </div>
      </section>

      {/* -- Organization Section -- */}
      <section className="rounded-2xl border border-[#F0F0F0] bg-white p-6">
        <h2 className="text-[14px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-5">
          Organization
        </h2>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[14px] font-semibold text-[#1A1A1A]">
              Organization Name
            </label>
            <div className="flex h-12 items-center rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 text-[15px] text-[#6B7280]">
              {orgName || "Your organization"}
            </div>
          </div>
          <p className="text-[13px] text-[#9CA3AF]">
            Organization settings are managed at the account level.
          </p>
        </div>
      </section>

      {/* -- Language Preference Section -- */}
      <section className="rounded-2xl border border-[#F0F0F0] bg-white p-6">
        <h2 className="text-[14px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">
          Language Preference
        </h2>
        <p className="text-[14px] text-[#6B7280] mb-5">
          Choose your preferred language for the interface.
        </p>

        <div className="flex gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLocale(lang.code)}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold transition-all ${
                locale === lang.code
                  ? "bg-[#1A1A1A] text-white shadow-sm"
                  : "bg-[#F0F0F0] text-[#6B7280] hover:bg-[#E5E7EB] hover:text-[#1A1A1A]"
              }`}
            >
              {locale === lang.code && <Check className="h-3.5 w-3.5" />}
              <span>{lang.label}</span>
              <span className="text-[12px] opacity-60">{lang.nativeLabel}</span>
            </button>
          ))}
        </div>
      </section>

      {/* -- Credits / Billing Section -- */}
      <section className="rounded-2xl border border-[#F0F0F0] bg-white p-6">
        <h2 className="text-[14px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-5">
          {t.credits.credits}
        </h2>

        <div className="flex items-end justify-between">
          <div>
            {loadingCredits ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-[#9CA3AF]" />
                <span className="text-[15px] text-[#9CA3AF]">
                  {t.common.loading}
                </span>
              </div>
            ) : credits !== null ? (
              <div>
                <p className="text-[36px] font-bold text-[#1A1A1A] leading-none">
                  {credits}
                </p>
                <p className="mt-1 text-[14px] text-[#6B7280]">
                  {t.credits.creditsLeft}
                </p>
              </div>
            ) : (
              <p className="text-[15px] text-[#9CA3AF]">
                Unable to load balance
              </p>
            )}
          </div>

          <button className="rounded-full bg-[#4D5D4B] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#3E4D3C] shadow-sm">
            Upgrade Plan
          </button>
        </div>

        <p className="mt-4 text-[13px] text-[#9CA3AF]">
          Credits are used when generating ads, videos, and other content.
        </p>
      </section>

      {/* -- Quick Links Section -- */}
      <section className="space-y-3">
        <h2 className="text-[14px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">
          Quick Links
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/dashboard/integrations"
            className="group flex items-center justify-between rounded-2xl border border-[#F0F0F0] bg-white p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <div>
              <p className="text-[15px] font-semibold text-[#1A1A1A]">
                Integrations
              </p>
              <p className="text-[13px] text-[#6B7280] mt-0.5">
                {connectedCount} platform{connectedCount !== 1 ? "s" : ""} connected
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-[#9CA3AF] transition-transform group-hover:translate-x-1 group-hover:text-[#1A1A1A]" />
          </Link>

          <Link
            href="/dashboard/brands"
            className="group flex items-center justify-between rounded-2xl border border-[#F0F0F0] bg-white p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <div>
              <p className="text-[15px] font-semibold text-[#1A1A1A]">
                Brands
              </p>
              <p className="text-[13px] text-[#6B7280] mt-0.5">
                Manage your brand profiles
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-[#9CA3AF] transition-transform group-hover:translate-x-1 group-hover:text-[#1A1A1A]" />
          </Link>
        </div>
      </section>
    </div>
  );
}
