"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  const [credits, setCredits] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setUserName(user.user_metadata?.name || user.user_metadata?.full_name || null);
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

    fetchUser();
    fetchCredits();
  }, []);

  const initials = getInitials(userName, userEmail);

  return (
    <div className="mx-auto max-w-2xl px-8 py-10 space-y-10">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">Settings</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-neutral-900">Account</h1>
      </div>

      <section className="border-t border-neutral-200 pt-8">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white text-[15px] font-semibold select-none">
            {initials}
          </div>
          <div>
            <p className="font-serif text-lg text-neutral-900">{userName || "Director"}</p>
            <p className="text-[13px] text-neutral-500 mt-0.5">{userEmail || "—"}</p>
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-200 pt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500 mb-4">Credits</p>
        <div className="flex items-end justify-between">
          <div>
            {loadingCredits ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                <span className="text-[14px] text-neutral-500">Loading</span>
              </div>
            ) : credits !== null ? (
              <p className="font-serif text-5xl leading-none text-neutral-900 tabular-nums">{credits}</p>
            ) : (
              <p className="text-[14px] text-neutral-400">Unable to load balance</p>
            )}
            <p className="mt-2 text-[13px] text-neutral-500">Credits burn when you generate.</p>
          </div>
          <button className="h-11 rounded-none border border-neutral-900 bg-neutral-900 px-6 text-xs uppercase tracking-[0.14em] text-white hover:bg-neutral-800">
            Upgrade
          </button>
        </div>
      </section>
    </div>
  );
}
