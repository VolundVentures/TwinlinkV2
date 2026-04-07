"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Globe,
  Plus,
  AlertCircle,
  Loader2,
  Play,
  Sparkles,
  Rocket,
  TrendingUp,
  Image,
  Film,
  Clock,
  Zap,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Brand = { id: string; name: string; logo_url?: string | null; is_default?: boolean; industry?: string };
type RecentGen = {
  id: string;
  title: string | null;
  type: string;
  status: string;
  created_at: string;
  generation_assets: Array<{ type: string; public_url: string | null; thumbnail_url: string | null }>;
};
type CampaignSummary = { id: string; name: string; status: string; credits_used: number; budget_credits: number };

function typeBadge(type: string) {
  if (type.includes("video") || type.includes("ugc")) return { label: "VIDEO", cls: "bg-[#6C5CE7]/10 text-[#6C5CE7]" };
  if (type.includes("static") || type.includes("image")) return { label: "IMAGE", cls: "bg-[#FF7675]/10 text-[#FF7675]" };
  if (type.includes("campaign")) return { label: "CAMPAIGN", cls: "bg-[#4D5D4B]/10 text-[#4D5D4B]" };
  return { label: type.replace(/_/g, " ").toUpperCase(), cls: "bg-[#F3F4F6] text-[#6B7280]" };
}

function getThumb(gen: RecentGen): string | null {
  const img = gen.generation_assets.find((a) => (a.type === "image" || a.type === "thumbnail") && a.public_url);
  return img?.thumbnail_url || img?.public_url || null;
}

function relativeTime(dateStr: string): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/* ── Add Brand ── */
function AddBrandInline({ onBrandAdded }: { onBrandAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setAnalyzing(true); setError(null);
    try {
      const res = await fetch("/api/brands/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      const brand = data.brand; const assets = data.assets;
      const saveRes = await fetch("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: brand.name, website_url: url, logo_url: assets?.logo || null, description: brand.description, primary_color: brand.primary_color, secondary_color: brand.secondary_color, accent_color: brand.accent_color, industry: brand.industry, target_audience: brand.target_audience, brand_voice: brand.brand_voice, products: brand.products || [], scraped_data: { tagline: brand.tagline, key_messages: brand.key_messages, images: assets?.images || [], screenshot: assets?.screenshot || null, favicon: assets?.favicon || null, ogImage: assets?.ogImage || null, colors: assets?.colors || [] }, is_default: true }) });
      if (!saveRes.ok) throw new Error("Failed to save brand");
      onBrandAdded();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); } finally { setAnalyzing(false); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mx-auto mt-20">
      <div className="rounded-2xl border border-[#F0F0F0] bg-white p-10 text-center shadow-elevated">
        <div className="mx-auto mb-6 h-14 w-14 rounded-2xl bg-[#4D5D4B]/10 flex items-center justify-center">
          <Globe className="h-6 w-6 text-[#4D5D4B]" />
        </div>
        <h2 className="text-[22px] font-bold text-[#1A1A1A] mb-2">Add your brand first</h2>
        <p className="text-[15px] text-[#6B7280] leading-relaxed mb-8 max-w-xs mx-auto">Enter your website URL and we&apos;ll extract your brand identity automatically.</p>
        <form onSubmit={handleAnalyze} className="flex gap-2">
          <input type="url" placeholder="https://your-brand.com" value={url} onChange={(e) => setUrl(e.target.value)} required disabled={analyzing}
            className="flex-1 h-12 px-4 text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none rounded-full border border-[#E5E7EB] focus:border-[#4D5D4B] focus:ring-2 focus:ring-[#4D5D4B]/10 transition-all" />
          <button type="submit" disabled={analyzing || !url.trim()} className="btn-primary h-12 shrink-0 disabled:opacity-40">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Add</>}
          </button>
        </form>
        {error && <p className="text-[14px] text-[#EF4444] mt-4 flex items-center justify-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
      </div>
    </motion.div>
  );
}

/* ── Main ── */
export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("there");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [recentGens, setRecentGens] = useState<RecentGen[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserName(user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "there");
      } catch {}
      try {
        const res = await fetch("/api/brands");
        if (res.ok) { const data = await res.json(); setBrands(data.brands ?? []); }
      } catch {} finally { setBrandsLoading(false); }
      try {
        const res = await fetch("/api/generations?limit=20");
        if (res.ok) { const data = await res.json(); setRecentGens(data.generations ?? []); }
      } catch {}
      try {
        const res = await fetch("/api/campaigns");
        if (res.ok) { const data = await res.json(); setCampaigns(data.campaigns ?? []); }
      } catch {}
      try {
        const res = await fetch("/api/credits");
        if (res.ok) { const data = await res.json(); setCredits(data.balance ?? null); }
      } catch {}
    }
    init();
  }, []);

  const hasBrands = brands.length > 0;
  // Only count generations with actual assets
  const gensWithAssets = recentGens.filter((g) => g.generation_assets && g.generation_assets.length > 0);
  const gensWithThumbs = gensWithAssets.filter((g) => getThumb(g));
  const totalImages = gensWithAssets.reduce((sum, g) => sum + g.generation_assets.filter((a) => a.type === "image").length, 0);
  const totalVideos = gensWithAssets.reduce((sum, g) => sum + g.generation_assets.filter((a) => a.type === "video").length, 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "production" || c.status === "plan_review");
  const completedCampaigns = campaigns.filter((c) => c.status === "completed");

  if (!brandsLoading && !hasBrands) {
    return <AddBrandInline onBrandAdded={() => router.refresh()} />;
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 max-w-[1200px] mx-auto space-y-6 md:space-y-8">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[28px] font-bold tracking-tight text-[#1A1A1A]">
          Welcome back, {userName}
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Here&apos;s what&apos;s happening with your brands.</p>
      </motion.div>

      {/* ── Two Primary Actions ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Chat */}
        <Link href="/dashboard/generate" className="group">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 h-full transition-all hover:border-[#1A1A1A] hover:shadow-md">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A1A1A]">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-[#1A1A1A]">Chat</h2>
                <p className="text-[12px] text-[#9CA3AF]">Quick creative assistant</p>
              </div>
            </div>
            <p className="text-[13px] text-[#6B7280] leading-relaxed">Generate ads, brainstorm ideas, create images and videos — one conversation.</p>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1A1A1A] mt-3 group-hover:gap-2.5 transition-all">
              Open chat <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* AI Creative Director */}
        <Link href="/dashboard/campaigns" className="group">
          <div className="rounded-2xl bg-gradient-to-br from-[#1A1A1A] to-[#333] p-6 h-full transition-all hover:shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4D5D4B]">
                <Rocket className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-white">AI Creative Director</h2>
                <p className="text-[12px] text-white/50">Full campaign autopilot</p>
              </div>
            </div>
            <p className="text-[13px] text-white/60 leading-relaxed">Set a brief, the AI plans your editorial calendar, generates all creatives, and schedules them.</p>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white mt-3 group-hover:gap-2.5 transition-all">
              Launch campaign <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </Link>
      </motion.div>

      {/* ── KPI Row ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-[#F0F0F0] bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-[#FBBF24]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Credits</span>
          </div>
          <p className="text-[28px] font-bold text-[#1A1A1A] font-mono leading-none">{credits ?? "—"}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">available</p>
        </div>

        <div className="rounded-2xl border border-[#F0F0F0] bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Image className="h-4 w-4 text-[#FF7675]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Images</span>
          </div>
          <p className="text-[28px] font-bold text-[#1A1A1A] font-mono leading-none">{totalImages}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">generated</p>
        </div>

        <div className="rounded-2xl border border-[#F0F0F0] bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Film className="h-4 w-4 text-[#6C5CE7]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Videos</span>
          </div>
          <p className="text-[28px] font-bold text-[#1A1A1A] font-mono leading-none">{totalVideos}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">produced</p>
        </div>

        <div className="rounded-2xl border border-[#F0F0F0] bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="h-4 w-4 text-[#4D5D4B]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Campaigns</span>
          </div>
          <p className="text-[28px] font-bold text-[#1A1A1A] font-mono leading-none">{campaigns.length}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">{activeCampaigns.length} active</p>
        </div>

        <div className="rounded-2xl border border-[#F0F0F0] bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-[#3B82F6]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Brands</span>
          </div>
          <p className="text-[28px] font-bold text-[#1A1A1A] font-mono leading-none">{brands.length}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">connected</p>
        </div>
      </motion.div>

      {/* ── Active Campaigns ── */}
      {activeCampaigns.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-bold text-[#1A1A1A]">Active Campaigns</h2>
            <Link href="/dashboard/campaigns" className="text-[12px] font-semibold text-[#4D5D4B] hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeCampaigns.slice(0, 4).map((c) => {
              const pct = c.budget_credits > 0 ? Math.min(100, (c.credits_used / c.budget_credits) * 100) : 0;
              return (
                <Link key={c.id} href={`/dashboard/campaigns/${c.id}`} className="group">
                  <div className="rounded-xl border border-[#F0F0F0] bg-white p-4 hover:border-[#E5E7EB] hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-semibold text-[#1A1A1A] truncate">{c.name}</span>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        c.status === "production" ? "bg-[#ECFDF5] text-[#059669] animate-pulse" : "bg-[#FFF7ED] text-[#D97706]"
                      )}>
                        {c.status === "production" ? "Active" : "Review"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div className="h-full bg-[#4D5D4B] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] mt-1.5 font-mono">{c.credits_used}/{c.budget_credits} credits</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Brands Row ── */}
      {hasBrands && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-bold text-[#1A1A1A]">Your Brands</h2>
            <Link href="/dashboard/brands" className="text-[12px] font-semibold text-[#4D5D4B] hover:underline flex items-center gap-1">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {brands.map((brand) => (
              <Link key={brand.id} href={`/dashboard/brands/${brand.id}`} className="group shrink-0">
                <div className="w-[180px] rounded-xl border border-[#F0F0F0] bg-white p-4 hover:border-[#E5E7EB] hover:shadow-sm transition-all">
                  <div className="h-10 w-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center mb-3 border border-[#F0F0F0]">
                    {brand.logo_url ? (
                      <img src={brand.logo_url} alt="" className="h-full w-full rounded-lg object-contain" />
                    ) : (
                      <span className="text-[14px] font-bold text-[#1A1A1A]">{brand.name[0]}</span>
                    )}
                  </div>
                  <p className="text-[13px] font-semibold text-[#1A1A1A] truncate">{brand.name}</p>
                  {brand.industry && <p className="text-[11px] text-[#9CA3AF] truncate">{brand.industry}</p>}
                </div>
              </Link>
            ))}
            <Link href="/dashboard/brands" className="shrink-0 group">
              <div className="w-[180px] rounded-xl border border-dashed border-[#E5E7EB] bg-white p-4 hover:border-[#4D5D4B] transition-all flex flex-col items-center justify-center h-full min-h-[100px]">
                <Plus className="h-5 w-5 text-[#9CA3AF] group-hover:text-[#4D5D4B] transition-colors" />
                <p className="text-[12px] text-[#9CA3AF] group-hover:text-[#4D5D4B] mt-1 font-medium">Add brand</p>
              </div>
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── Recent Creations ── */}
      {gensWithThumbs.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-bold text-[#1A1A1A]">Recent Creations</h2>
            <Link href="/dashboard/generations" className="text-[12px] font-semibold text-[#4D5D4B] hover:underline flex items-center gap-1">
              Gallery <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {gensWithThumbs.slice(0, 10).map((gen) => {
              const thumbUrl = getThumb(gen)!;
              const vid = gen.generation_assets.find((a) => a.type === "video" && a.public_url);
              const badge = typeBadge(gen.type);
              return (
                <Link key={gen.id} href={`/dashboard/generations/${gen.id}`} className="block group">
                  <div className="rounded-xl overflow-hidden border border-[#F0F0F0] bg-white transition-all hover:shadow-md hover:-translate-y-0.5">
                    <div className="aspect-[3/4] relative overflow-hidden">
                      <img src={thumbUrl} alt={gen.title || gen.type} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                      {vid && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-lg">
                            <Play className="h-3 w-3 text-[#1A1A1A] ml-px" fill="currentColor" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[12px] font-semibold text-[#1A1A1A] truncate">{gen.title || gen.type.replace(/_/g, " ")}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", badge.cls)}>{badge.label}</span>
                        <span className="text-[10px] text-[#9CA3AF]">{relativeTime(gen.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Quick Links ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <Link href="/dashboard/calendar" className="rounded-xl border border-[#F0F0F0] bg-white p-4 hover:border-[#E5E7EB] hover:shadow-sm transition-all flex items-center gap-3 group">
          <CalendarDays className="h-5 w-5 text-[#9CA3AF] group-hover:text-[#1A1A1A] transition-colors" />
          <div>
            <p className="text-[13px] font-semibold text-[#1A1A1A]">Content Calendar</p>
            <p className="text-[11px] text-[#9CA3AF]">Schedule and manage posts</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-[#D1D5DB] group-hover:text-[#1A1A1A] ml-auto transition-colors" />
        </Link>

        <Link href="/dashboard/competitors" className="rounded-xl border border-[#F0F0F0] bg-white p-4 hover:border-[#E5E7EB] hover:shadow-sm transition-all flex items-center gap-3 group">
          <TrendingUp className="h-5 w-5 text-[#9CA3AF] group-hover:text-[#1A1A1A] transition-colors" />
          <div>
            <p className="text-[13px] font-semibold text-[#1A1A1A]">Competitor Intel</p>
            <p className="text-[11px] text-[#9CA3AF]">Analyze competitor ads</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-[#D1D5DB] group-hover:text-[#1A1A1A] ml-auto transition-colors" />
        </Link>

        <Link href="/dashboard/characters" className="rounded-xl border border-[#F0F0F0] bg-white p-4 hover:border-[#E5E7EB] hover:shadow-sm transition-all flex items-center gap-3 group">
          <Sparkles className="h-5 w-5 text-[#9CA3AF] group-hover:text-[#1A1A1A] transition-colors" />
          <div>
            <p className="text-[13px] font-semibold text-[#1A1A1A]">AI Avatars</p>
            <p className="text-[11px] text-[#9CA3AF]">Manage AI characters</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-[#D1D5DB] group-hover:text-[#1A1A1A] ml-auto transition-colors" />
        </Link>
      </motion.div>
    </div>
  );
}
