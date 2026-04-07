"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Rocket,
  ArrowRight,
  Sparkles,
  Loader2,
  CalendarDays,
  DollarSign,
  Target,
  Megaphone,
  ShoppingBag,
  Heart,
  TrendingUp,
  Users,
  Smartphone,
  Monitor,
  Square,
} from "lucide-react";
import { spring, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Brand = { id: string; name: string; logo_url?: string | null; is_default?: boolean; products?: Array<{ name: string }> };

const GOALS = [
  { id: "brand_awareness", label: "Brand Awareness", icon: Megaphone, gradient: "from-[#6C5CE7] to-[#4834d4]" },
  { id: "product_launch", label: "Product Launch", icon: ShoppingBag, gradient: "from-[#FF7675] to-[#d63031]" },
  { id: "lead_gen", label: "Lead Generation", icon: Target, gradient: "from-[#4D5D4B] to-[#2d3a2b]" },
  { id: "sales", label: "Drive Sales", icon: DollarSign, gradient: "from-[#3B82F6] to-[#1d4ed8]" },
  { id: "engagement", label: "Engagement", icon: Heart, gradient: "from-[#FBBF24] to-[#d97706]" },
  { id: "retargeting", label: "Retargeting", icon: Users, gradient: "from-[#1A1A1A] to-[#000]" },
];

const PLATFORMS = [
  { id: "instagram", label: "Instagram", color: "#E4405F" },
  { id: "tiktok", label: "TikTok", color: "#00F2EA" },
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2" },
  { id: "x", label: "X", color: "#1A1A1A" },
];

const CONTENT_MIX = [
  { id: "balanced", label: "Balanced", description: "Mix of video, images, and carousels" },
  { id: "video_focused", label: "Video Heavy", description: "Prioritize video ads for maximum engagement" },
  { id: "image_heavy", label: "Image Heavy", description: "Static ads and carousels for quick production" },
];

const BUDGET_OPTIONS = [
  { credits: 100, label: "Starter", output: "~3 videos, 5 images" },
  { credits: 250, label: "Growth", output: "~5 videos, 3 carousels, 10 images" },
  { credits: 500, label: "Scale", output: "~10 videos, 5 carousels, 20 images" },
  { credits: 1000, label: "Enterprise", output: "~20 videos, 10 carousels, 40 images" },
];

const TIMEFRAME_OPTIONS = [
  { id: "1_week", label: "This Week", days: 7 },
  { id: "2_weeks", label: "2 Weeks", days: 14 },
  { id: "1_month", label: "This Month", days: 30 },
  { id: "3_months", label: "Quarter", days: 90 },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "tiktok"]);
  const [contentMix, setContentMix] = useState("balanced");
  const [budget, setBudget] = useState(250);
  const [timeframe, setTimeframe] = useState("2_weeks");
  const [notes, setNotes] = useState("");
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    async function loadBrands() {
      try {
        const res = await fetch("/api/brands");
        if (res.ok) {
          const d = await res.json();
          const list = d.brands || [];
          setBrands(list);
          if (list.length > 0) {
            const def = list.find((b: Brand) => b.is_default) || list[0];
            setSelectedBrand(def.id);
          }
        }
      } catch {}
    }
    loadBrands();
  }, []);

  function toggleGoal(id: string) {
    setGoals((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]);
  }

  function togglePlatform(id: string) {
    setPlatforms((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  async function handleLaunch() {
    if (!selectedBrand || goals.length === 0 || platforms.length === 0) return;
    setLaunching(true);

    const today = new Date();
    const tf = TIMEFRAME_OPTIONS.find((t) => t.id === timeframe) || TIMEFRAME_OPTIONS[1];
    const endDate = new Date(today.getTime() + tf.days * 86400000);

    try {
      // Create campaign
      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Campaign",
          brandId: selectedBrand,
          budgetCredits: budget,
          autonomyLevel: "semi",
          brief: {
            budget,
            timeframe_start: today.toISOString().split("T")[0],
            timeframe_end: endDate.toISOString().split("T")[0],
            goals,
            platforms,
            content_mix: contentMix,
            key_dates: [],
            product_ids: [],
            notes,
          },
        }),
      });

      if (!createRes.ok) throw new Error("Failed to create campaign");
      const { campaign } = await createRes.json();

      // Trigger AI planning
      await fetch(`/api/campaigns/${campaign.id}/plan`, { method: "POST" });

      // Navigate to campaign page
      router.push(`/dashboard/campaigns/${campaign.id}`);
    } catch (err) {
      console.error("Launch failed:", err);
      setLaunching(false);
    }
  }

  const canLaunch = !launching && selectedBrand && goals.length > 0 && platforms.length > 0;

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-10">
        {/* Header */}
        <motion.div variants={staggerItem}>
          <h1 className="text-[32px] font-bold text-[#1A1A1A]">Launch a Campaign</h1>
          <p className="text-[15px] text-[#6B7280] mt-1">
            Brief your AI creative director
          </p>
        </motion.div>

        {/* Brand selector */}
        <motion.div variants={staggerItem}>
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">Brand</p>
          <div className="flex flex-wrap gap-2">
            {brands.map((brand) => (
              <button
                key={brand.id}
                onClick={() => setSelectedBrand(brand.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-2xl border text-[13px] font-medium transition-all",
                  selectedBrand === brand.id
                    ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                    : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]"
                )}
              >
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt="" className="h-6 w-6 rounded-lg object-contain bg-white" />
                ) : (
                  <span className={cn("h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-bold", selectedBrand === brand.id ? "bg-white/20" : "bg-[#F3F4F6]")}>
                    {brand.name[0]}
                  </span>
                )}
                {brand.name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Goals */}
        <motion.div variants={staggerItem}>
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">Goals</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {GOALS.map((goal) => {
              const Icon = goal.icon;
              const selected = goals.includes(goal.id);
              return (
                <button
                  key={goal.id}
                  onClick={() => toggleGoal(goal.id)}
                  className={cn(
                    "flex flex-col items-start gap-2 p-4 rounded-2xl border text-left transition-all",
                    selected
                      ? `bg-gradient-to-br ${goal.gradient} border-transparent text-white shadow-lg`
                      : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]"
                  )}
                >
                  <Icon className={cn("h-5 w-5", selected ? "text-white/90" : "text-[#9CA3AF]")} />
                  <span className="text-[13px] font-medium">{goal.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Platforms */}
        <motion.div variants={staggerItem}>
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">Platforms</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const selected = platforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-2xl border text-[13px] font-medium transition-all",
                    selected
                      ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                      : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]"
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selected ? "white" : p.color }} />
                  {p.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Budget */}
        <motion.div variants={staggerItem}>
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">Budget</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {BUDGET_OPTIONS.map((opt) => (
              <button
                key={opt.credits}
                onClick={() => setBudget(opt.credits)}
                className={cn(
                  "flex flex-col items-center px-4 py-5 rounded-2xl border text-center transition-all",
                  budget === opt.credits
                    ? "ring-2 ring-[#4D5D4B] bg-[#4D5D4B]/5 border-transparent text-[#1A1A1A]"
                    : "border-[#E5E7EB] bg-white text-[#1A1A1A] hover:border-[#D1D5DB]"
                )}
              >
                <span className="text-[24px] font-bold">{opt.credits}</span>
                <span className="text-[10px] text-[#9CA3AF] mt-0.5">credits</span>
                <span className="text-[10px] text-[#9CA3AF] mt-2">{opt.output}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Timeframe */}
        <motion.div variants={staggerItem}>
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">Timeframe</p>
          <div className="flex flex-wrap gap-2">
            {TIMEFRAME_OPTIONS.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className={cn(
                  "px-4 py-3 rounded-2xl border text-[13px] font-medium transition-all",
                  timeframe === tf.id
                    ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                    : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Content mix */}
        <motion.div variants={staggerItem}>
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">Content Mix</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {CONTENT_MIX.map((mix) => (
              <button
                key={mix.id}
                onClick={() => setContentMix(mix.id)}
                className={cn(
                  "flex flex-col items-start px-4 py-4 rounded-2xl text-left transition-all",
                  contentMix === mix.id
                    ? "border-l-[3px] border-l-[#4D5D4B] border-y border-r border-y-transparent border-r-transparent bg-[#4D5D4B]/[0.03]"
                    : "border border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                )}
              >
                <span className={cn("text-[13px] font-medium", contentMix === mix.id ? "text-[#1A1A1A]" : "text-[#1A1A1A]")}>{mix.label}</span>
                <span className="text-[11px] text-[#9CA3AF] mt-1">{mix.description}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Notes */}
        <motion.div variants={staggerItem}>
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">Notes <span className="font-normal normal-case tracking-normal">(optional)</span></p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any specific instructions, themes, upcoming events, or creative preferences..."
            rows={3}
            className="w-full bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] resize-none outline-none focus:border-[#4D5D4B] transition-colors"
          />
        </motion.div>

        {/* Launch button */}
        <motion.div variants={staggerItem} className="pb-8">
          <motion.button
            onClick={handleLaunch}
            disabled={launching || !selectedBrand || goals.length === 0 || platforms.length === 0}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={spring.snappy}
            className={cn(
              "flex items-center justify-center gap-3 w-full h-14 rounded-full text-[16px] font-bold transition-all",
              canLaunch
                ? "bg-[#4D5D4B] text-white hover:bg-[#3d4a3b] shadow-medium"
                : "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed"
            )}
          >
            {launching ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> AI is planning your campaign...</>
            ) : (
              <><Sparkles className="h-5 w-5" /> Let the Director Plan</>
            )}
          </motion.button>
          <p className="text-center text-[11px] text-[#9CA3AF] mt-3">
            The AI will create an editorial plan for your review before producing anything.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
