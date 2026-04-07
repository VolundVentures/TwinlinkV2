"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { spring, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignStatus } from "@/lib/database.types";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  briefing:    { label: "Briefing",      cls: "bg-[#F3F4F6] text-[#6B7280]" },
  planning:    { label: "AI Planning",   cls: "bg-[#6C5CE7]/10 text-[#6C5CE7]" },
  plan_review: { label: "Review Plan",   cls: "bg-[#FBBF24]/10 text-[#D97706]" },
  approved:    { label: "Approved",      cls: "bg-[#4D5D4B]/10 text-[#4D5D4B]" },
  production:  { label: "In Production", cls: "bg-[#4D5D4B]/10 text-[#4D5D4B]" },
  paused:      { label: "Paused",        cls: "bg-[#F3F4F6] text-[#6B7280]" },
  completed:   { label: "Completed",     cls: "bg-[#1A1A1A] text-white" },
  cancelled:   { label: "Cancelled",     cls: "bg-[#EF4444]/10 text-[#EF4444]" },
};

function relativeTime(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/campaigns");
        if (res.ok) { const d = await res.json(); setCampaigns(d.campaigns || []); }
      } catch {} finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="px-4 sm:px-6 md:px-8 py-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="shimmer h-9 w-40 rounded-xl" />
            <div className="shimmer h-5 w-56 rounded-lg" />
          </div>
          <div className="shimmer h-10 w-36 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="shimmer h-28 rounded-2xl" />)}
        </div>
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="shimmer h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const active = campaigns.filter(c => ["planning", "production", "approved"].includes(c.status));
  const completed = campaigns.filter(c => c.status === "completed");
  const totalCredits = campaigns.reduce((s, c) => s + c.credits_used, 0);

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] text-[#1A1A1A]">Campaigns</h1>
          <p className="text-[15px] text-[#6B7280] mt-1">Autonomous content production</p>
        </div>
        <Link href="/dashboard/campaigns/new" className="btn-primary text-[14px]">
          <Plus className="h-4 w-4" />
          New Campaign
        </Link>
      </div>

      {/* Stats */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="rounded-2xl border border-[#4D5D4B]/12 bg-[#4D5D4B]/[0.03] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#4D5D4B] mb-2">Active</p>
            <p className="text-[36px] font-bold text-[#1A1A1A] leading-none">{active.length}</p>
            <p className="text-[13px] text-[#6B7280] mt-1">campaigns running</p>
          </div>
          <div className="rounded-2xl border border-[#6C5CE7]/12 bg-[#6C5CE7]/[0.03] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6C5CE7] mb-2">Total</p>
            <p className="text-[36px] font-bold text-[#1A1A1A] leading-none">{campaigns.length}</p>
            <p className="text-[13px] text-[#6B7280] mt-1">campaigns</p>
          </div>
          <div className="rounded-2xl border border-[#FF7675]/12 bg-[#FF7675]/[0.03] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#FF7675] mb-2">Completed</p>
            <p className="text-[36px] font-bold text-[#1A1A1A] leading-none">{completed.length}</p>
            <p className="text-[13px] text-[#6B7280] mt-1">finished</p>
          </div>
          <div className="rounded-2xl border border-[#3B82F6]/12 bg-[#3B82F6]/[0.03] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#3B82F6] mb-2">Credits</p>
            <p className="text-[36px] font-bold text-[#1A1A1A] leading-none">{totalCredits.toLocaleString()}</p>
            <p className="text-[13px] text-[#6B7280] mt-1">used total</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {campaigns.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="relative mb-6">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#6C5CE7]/10 to-[#4D5D4B]/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-[#6B7280]" />
            </div>
          </div>
          <h2 className="text-[22px] font-bold text-[#1A1A1A] mb-3">Your AI creative director awaits</h2>
          <p className="text-[15px] text-[#6B7280] max-w-md mb-8 leading-relaxed">
            Give it a budget and timeframe. It will plan your entire content calendar,
            produce every asset, and schedule everything — autonomously.
          </p>
          <Link href="/dashboard/campaigns/new" className="btn-primary text-[15px] px-8 py-3">
            <Sparkles className="h-4 w-4" />
            Launch First Campaign
          </Link>
        </motion.div>
      ) : (
        /* Campaign list */
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
          {campaigns.map((campaign) => {
            const badge = STATUS_BADGE[campaign.status] || STATUS_BADGE.briefing;
            const isActive = ["planning", "production"].includes(campaign.status);
            const brief = campaign.brief as Record<string, unknown>;
            const itemCount = (campaign as unknown as { campaign_items: Array<{ count: number }> }).campaign_items?.[0]?.count || 0;
            const budgetPct = campaign.budget_credits > 0 ? Math.min(100, (campaign.credits_used / campaign.budget_credits) * 100) : 0;

            return (
              <motion.div key={campaign.id} variants={staggerItem}>
                <Link href={`/dashboard/campaigns/${campaign.id}`} className="block group">
                  <div className="rounded-2xl border border-[#F0F0F0] bg-white p-6 transition-all duration-200 hover:shadow-medium hover:-translate-y-0.5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Name + badge */}
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-[18px] font-bold text-[#1A1A1A] truncate">{campaign.name}</h3>
                          <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0", badge.cls)}>
                            {badge.label}
                          </span>
                          {isActive && <span className="w-2 h-2 rounded-full bg-[#4D5D4B] animate-pulse shrink-0" />}
                        </div>

                        {/* Meta */}
                        <p className="text-[13px] text-[#6B7280] mb-4">
                          {relativeTime(campaign.created_at)} · {itemCount} deliverable{itemCount !== 1 ? "s" : ""} · {campaign.credits_used}/{campaign.budget_credits} credits
                        </p>

                        {/* Progress bar */}
                        <div className="max-w-md">
                          <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${budgetPct}%`,
                                background: budgetPct >= 100 ? "#EF4444" : budgetPct >= 75 ? "#FBBF24" : "linear-gradient(90deg, #4D5D4B, #6b8f68)"
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="h-5 w-5 text-[#D1D5DB] group-hover:text-[#1A1A1A] transition-colors shrink-0 ml-4 mt-1" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
