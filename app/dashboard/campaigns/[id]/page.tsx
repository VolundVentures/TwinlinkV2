"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Loader2,
  Sparkles,
  Play,
  Pause,
  XCircle,
  CalendarDays,
  ImageIcon,
  Film,
  Layers,
  Music,
  Check,
  RotateCcw,
  Eye,
  AlertCircle,
  Trash2,
  MessageSquare,
  Send,
  ChevronDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { spring, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignItem, CampaignItemStatus } from "@/lib/database.types";

const ITEM_TYPE_ICONS: Record<string, typeof Film> = {
  static_image: ImageIcon,
  ugc_video: Film,
  carousel: Layers,
  broll_video: Film,
  cinematic_video: Film,
  avatar_video: Film,
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  static_image: "Static Ad",
  ugc_video: "UGC Video",
  carousel: "Carousel",
  broll_video: "B-roll Video",
  cinematic_video: "Cinematic Video",
  avatar_video: "Avatar Video",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  tiktok: "#00F2EA",
  linkedin: "#0A66C2",
  x: "#000000",
};

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  planned: { className: "bg-[#F3F4F6] text-[#6B7280]", label: "Planned" },
  approved: { className: "bg-[#4D5D4B]/10 text-[#4D5D4B]", label: "Approved" },
  queued: { className: "bg-[#EEF2FF] text-[#6366F1]", label: "Queued" },
  in_production: { className: "bg-[#FFF7ED] text-[#D97706]", label: "Producing" },
  completed: { className: "bg-[#4D5D4B]/10 text-[#4D5D4B]", label: "Done" },
  pending_review: { className: "bg-[#F3E8FF] text-[#7C3AED]", label: "Review" },
  approved_final: { className: "bg-[#4D5D4B]/10 text-[#4D5D4B]", label: "Published" },
  failed: { className: "bg-[#FEF2F2] text-[#EF4444]", label: "Failed" },
  cancelled: { className: "bg-[#F3F4F6] text-[#6B7280]", label: "Cancelled" },
};

const ITEM_TYPE_BORDER_COLORS: Record<string, string> = {
  static_image: "#FF7675",
  carousel: "#FF7675",
  ugc_video: "#4D5D4B",
  broll_video: "#6C5CE7",
  cinematic_video: "#6C5CE7",
  avatar_video: "#6C5CE7",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = params.id as string;
  const tab = searchParams.get("tab") || "plan";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [items, setItems] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadCampaign() {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      if (res.ok) {
        const d = await res.json();
        setCampaign(d.campaign);
        setItems(d.campaign?.campaign_items || []);
      }
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { loadCampaign(); }, [campaignId]);

  // Poll for updates during production
  useEffect(() => {
    if (!campaign || !["production", "planning"].includes(campaign.status)) return;
    const interval = setInterval(loadCampaign, 5000);
    return () => clearInterval(interval);
  }, [campaign?.status]);

  async function handleApproveSelected() {
    if (selectedItems.size === 0) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: Array.from(selectedItems) }),
      });
      if (res.ok) {
        setSelectedItems(new Set());
        await loadCampaign();
      }
    } catch {} finally { setApproving(false); }
  }

  function handleSelectAll() {
    const plannedItems = items.filter((i) => i.status === "planned");
    if (selectedItems.size === plannedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(plannedItems.map((i) => i.id)));
    }
  }

  function toggleItem(id: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleDeleteItem(itemId: string) {
    setDeleting(itemId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/items/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        if (expandedItem === itemId) setExpandedItem(null);
      }
    } catch {} finally { setDeleting(null); }
  }

  async function handleCommentItem(itemId: string) {
    if (!commentText.trim()) return;
    setCommenting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: commentText }),
      });
      if (res.ok) {
        const { item: updated } = await res.json();
        setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, ...updated } : i));
        setCommentText("");
      }
    } catch {} finally { setCommenting(false); }
  }

  if (loading) {
    return (
      <div className="px-8 py-6 space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="px-8 py-6 text-center py-20">
        <p className="text-[#6B7280]">Campaign not found.</p>
        <Link href="/dashboard/campaigns" className="text-[#4D5D4B] underline mt-2 inline-block">Back to campaigns</Link>
      </div>
    );
  }

  const isPlanning = campaign.status === "planning";
  const isReview = campaign.status === "plan_review";
  const isProduction = campaign.status === "production";
  const isCompleted = campaign.status === "completed";
  const budgetPercent = campaign.budget_credits > 0 ? Math.min(100, (campaign.credits_used / campaign.budget_credits) * 100) : 0;

  // Group items by status for production view
  const queuedItems = items.filter((i) => ["queued", "approved"].includes(i.status));
  const activeItems = items.filter((i) => i.status === "in_production");
  const completedItems = items.filter((i) => ["completed", "pending_review", "approved_final"].includes(i.status));
  const failedItems = items.filter((i) => i.status === "failed");

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 px-8 py-6 space-y-6 pb-24">
        {/* Back + Header */}
        <div>
          <Link
            href="/dashboard/campaigns"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#6B7280] hover:text-[#1A1A1A] transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Campaigns
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-[32px] font-bold text-[#1A1A1A] tracking-tight leading-tight">
                {campaign.name}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span
                  className={cn(
                    "inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold",
                    isPlanning
                      ? "bg-[#F3E8FF] text-[#7C3AED]"
                      : isReview
                      ? "bg-[#FFF7ED] text-[#D97706]"
                      : isProduction
                      ? "bg-[#ECFDF5] text-[#059669] animate-pulse"
                      : isCompleted
                      ? "bg-[#ECFDF5] text-[#059669]"
                      : "bg-[#F3F4F6] text-[#6B7280]"
                  )}
                >
                  {isPlanning
                    ? "Planning"
                    : isReview
                    ? "Review"
                    : isProduction
                    ? "Active"
                    : campaign.status.replace(/_/g, " ")}
                </span>
                <span className="text-[14px] text-[#6B7280]">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Budget / Credits */}
            <div className="text-right min-w-[200px]">
              <div className="flex items-baseline justify-end gap-1.5 mb-2">
                <span className="font-mono text-[14px] font-bold text-[#1A1A1A]">
                  {campaign.credits_used}
                </span>
                <span className="text-[14px] text-[#6B7280]">
                  / {campaign.budget_credits} credits
                </span>
              </div>
              <div className="h-2 w-full bg-[#F3F4F6] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#4D5D4B] rounded-full"
                  style={{ width: `${budgetPercent}%` }}
                  animate={{ width: `${budgetPercent}%` }}
                  transition={spring.smooth}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Planning state */}
        {isPlanning && (
          <div className="text-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#4D5D4B] mx-auto mb-4" />
            <h2 className="text-[18px] font-semibold text-[#1A1A1A]">AI is crafting your editorial plan</h2>
            <p className="text-[13px] text-[#9CA3AF] mt-2">
              Analyzing your brand, goals, and budget to create the optimal content strategy...
            </p>
          </div>
        )}

        {/* Tabs for review/production */}
        {!isPlanning && (
          <>
            <div className="flex gap-8 border-b border-[#F0F0F0]">
              {[
                { id: "plan", label: "Editorial Plan" },
                { id: "production", label: "Production" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => router.replace(`/dashboard/campaigns/${campaignId}?tab=${t.id}`)}
                  className={cn(
                    "relative pb-3 text-[14px] font-semibold transition-colors",
                    tab === t.id
                      ? "text-[#1A1A1A]"
                      : "text-[#9CA3AF] hover:text-[#6B7280]"
                  )}
                >
                  {t.label}
                  {tab === t.id && (
                    <motion.span
                      layoutId="campaign-tab"
                      className="absolute inset-x-0 -bottom-px h-[2px] bg-[#1A1A1A] rounded-full"
                      transition={spring.snappy}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Plan tab */}
            {tab === "plan" && (
              <div className="space-y-3">
                {items
                  .sort(
                    (a, b) =>
                      new Date(a.scheduled_at).getTime() -
                      new Date(b.scheduled_at).getTime()
                  )
                  .map((item) => {
                    const TypeIcon = ITEM_TYPE_ICONS[item.item_type] || Film;
                    const statusStyle =
                      STATUS_STYLES[item.status] || STATUS_STYLES.planned;
                    const brief = item.creative_brief as Record<string, unknown>;
                    const isSelected = selectedItems.has(item.id);
                    const isExpanded = expandedItem === item.id;
                    const borderColor =
                      ITEM_TYPE_BORDER_COLORS[item.item_type] || "#6C5CE7";

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        layout
                        className={cn(
                          "rounded-2xl border overflow-hidden transition-all bg-white",
                          isSelected
                            ? "border-[#1A1A1A] shadow-md"
                            : "border-[#F0F0F0] hover:border-[#E5E7EB]"
                        )}
                      >
                        <div className="flex">
                          {/* Colored left border indicator */}
                          <div
                            className="w-[3px] shrink-0 rounded-l-2xl"
                            style={{ backgroundColor: borderColor }}
                          />

                          <div className="flex-1 p-5">
                            <div className="flex items-start gap-4">
                              {/* Checkbox */}
                              {isReview && (
                                <button
                                  onClick={() => toggleItem(item.id)}
                                  className={cn(
                                    "mt-0.5 h-5 w-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                                    isSelected
                                      ? "bg-[#4D5D4B] border-[#4D5D4B] text-white"
                                      : "border-[#E5E7EB] hover:border-[#9CA3AF]"
                                  )}
                                >
                                  {isSelected && (
                                    <Check className="h-3 w-3" />
                                  )}
                                </button>
                              )}

                              <div className="flex-1 min-w-0">
                                {/* Top row: type + platform + status */}
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-[14px] font-bold text-[#1A1A1A]">
                                    {ITEM_TYPE_LABELS[item.item_type] ||
                                      item.item_type}
                                  </span>

                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className="h-2 w-2 rounded-full shrink-0"
                                      style={{
                                        backgroundColor:
                                          PLATFORM_COLORS[item.platform] ||
                                          "#666",
                                      }}
                                    />
                                    <span className="text-[13px] text-[#6B7280] capitalize">
                                      {item.platform}
                                    </span>
                                  </span>

                                  <span
                                    className={cn(
                                      "ml-auto px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                                      statusStyle.className
                                    )}
                                  >
                                    {statusStyle.label}
                                  </span>
                                </div>

                                {/* Description */}
                                {typeof brief.description === "string" &&
                                  brief.description && (
                                    <p
                                      className={cn(
                                        "text-[14px] text-[#6B7280] leading-relaxed mb-3",
                                        !isExpanded && "line-clamp-2"
                                      )}
                                    >
                                      {brief.description}
                                    </p>
                                  )}

                                {/* Schedule + Credits */}
                                <div className="flex items-center gap-5">
                                  <span className="flex items-center gap-1.5 text-[13px] text-[#9CA3AF]">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    {formatDate(item.scheduled_at)} at{" "}
                                    {formatTime(item.scheduled_at)}
                                  </span>
                                  <span className="font-mono text-[13px] font-semibold text-[#1A1A1A]">
                                    {item.estimated_cost} credits
                                  </span>
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() =>
                                    setExpandedItem(
                                      isExpanded ? null : item.id
                                    )
                                  }
                                  className={cn(
                                    "h-8 px-3 flex items-center gap-1.5 rounded-lg text-[12px] font-medium transition-all",
                                    isExpanded
                                      ? "bg-[#4D5D4B]/10 text-[#4D5D4B]"
                                      : "text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F3F4F6]"
                                  )}
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Feedback
                                  <ChevronDown
                                    className={cn(
                                      "h-3 w-3 transition-transform",
                                      isExpanded && "rotate-180"
                                    )}
                                  />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  disabled={deleting === item.id}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg text-[#D1D5DB] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded: comment to agent */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={spring.smooth}
                              className="border-t border-[#F0F0F0] overflow-hidden"
                            >
                              <div className="p-4 bg-[#FAFAFA]">
                                {item.review_notes && (
                                  <div className="mb-3 flex items-start gap-2 text-[11px] text-[#4D5D4B] bg-[#4D5D4B]/5 rounded-lg px-3 py-2">
                                    <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                                    <span>
                                      Previous note: {item.review_notes}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <input
                                    value={commentText}
                                    onChange={(e) =>
                                      setCommentText(e.target.value)
                                    }
                                    placeholder="Give feedback to the AI director..."
                                    className="flex-1 h-12 px-3 bg-white border border-[#E5E7EB] rounded-xl text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none focus:border-[#4D5D4B]"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        handleCommentItem(item.id);
                                    }}
                                  />
                                  <button
                                    onClick={() =>
                                      handleCommentItem(item.id)
                                    }
                                    disabled={
                                      commenting || !commentText.trim()
                                    }
                                    className="h-12 px-4 bg-[#4D5D4B] text-white rounded-full text-[13px] font-medium flex items-center gap-1.5 hover:bg-[#3d4a3b] transition-colors disabled:opacity-40"
                                  >
                                    {commenting ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Send className="h-3 w-3" />
                                    )}
                                    Revise
                                  </button>
                                </div>
                                <p className="text-[10px] text-[#9CA3AF] mt-2">
                                  The AI will revise this item&apos;s creative
                                  brief based on your feedback.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
              </div>
            )}

            {/* Production tab */}
            {tab === "production" && (
              <div className="space-y-6">
                {/* Progress overview */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Queued", count: queuedItems.length, color: "text-[#9CA3AF]" },
                    { label: "Producing", count: activeItems.length, color: "text-[#D97706]" },
                    { label: "Completed", count: completedItems.length, color: "text-[#4D5D4B]" },
                    { label: "Failed", count: failedItems.length, color: "text-[#FF7675]" },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="bg-white rounded-2xl border border-[#F0F0F0] p-4 text-center">
                      <p className={cn("text-[24px] font-bold font-mono", color)}>{count}</p>
                      <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Active production items */}
                {activeItems.length > 0 && (
                  <div>
                    <p className="label-caps mb-3 flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin text-[#4D5D4B]" /> Currently Producing
                    </p>
                    {activeItems.map((item) => {
                      const TypeIcon = ITEM_TYPE_ICONS[item.item_type] || Film;
                      return (
                        <div key={item.id} className="bg-white rounded-2xl border-2 border-[#4D5D4B]/20 p-4 animate-pulse">
                          <div className="flex items-center gap-3">
                            <TypeIcon className="h-5 w-5 text-[#4D5D4B]" />
                            <span className="text-[14px] font-medium text-[#1A1A1A]">{ITEM_TYPE_LABELS[item.item_type]}</span>
                            <span className="text-[11px] text-[#4D5D4B]">Generating...</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Completed items */}
                {completedItems.length > 0 && (
                  <div>
                    <p className="label-caps mb-3">Completed</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {completedItems.map((item) => {
                        const TypeIcon = ITEM_TYPE_ICONS[item.item_type] || Film;
                        return (
                          <div key={item.id} className="bg-white rounded-2xl border border-[#F0F0F0] p-3">
                            <div className="aspect-video bg-[#F3F4F6] rounded-lg flex items-center justify-center mb-2">
                              <TypeIcon className="h-6 w-6 text-[#9CA3AF]" />
                            </div>
                            <p className="text-[12px] font-medium text-[#1A1A1A]">{ITEM_TYPE_LABELS[item.item_type]}</p>
                            <p className="text-[10px] text-[#9CA3AF]">{item.platform} &middot; {item.actual_cost} credits</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Failed items */}
                {failedItems.length > 0 && (
                  <div className="bg-[#FFF0F0] rounded-2xl p-4">
                    <p className="flex items-center gap-2 text-[13px] font-medium text-[#FF7675] mb-2">
                      <AlertCircle className="h-4 w-4" /> {failedItems.length} item{failedItems.length !== 1 ? "s" : ""} failed
                    </p>
                    {failedItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-1.5">
                        <span className="text-[12px] text-[#FF7675]">{ITEM_TYPE_LABELS[item.item_type]} — {item.error_message || "Unknown error"}</span>
                        <button className="text-[11px] text-[#FF7675] font-medium flex items-center gap-1 hover:underline">
                          <RotateCcw className="h-3 w-3" /> Retry
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Queued items */}
                {queuedItems.length > 0 && (
                  <div>
                    <p className="label-caps mb-3">Queue ({queuedItems.length} remaining)</p>
                    <div className="space-y-1.5">
                      {queuedItems.map((item, i) => (
                        <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl border border-[#F0F0F0] px-3 py-2 opacity-60">
                          <span className="font-mono text-[10px] text-[#9CA3AF] w-6">{i + 1}</span>
                          <span className="text-[12px] text-[#6B7280]">{ITEM_TYPE_LABELS[item.item_type]}</span>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[item.platform] || "#666" }} />
                          <span className="text-[10px] text-[#9CA3AF] ml-auto">{formatDate(item.scheduled_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nothing in production */}
                {!isProduction && items.length > 0 && activeItems.length === 0 && queuedItems.length === 0 && (
                  <div className="text-center py-12">
                    <CheckCircle className="h-10 w-10 text-[#4D5D4B] mx-auto mb-3" />
                    <p className="text-[16px] font-semibold text-[#1A1A1A]">
                      {isCompleted ? "Campaign Complete!" : "All items processed"}
                    </p>
                    <p className="text-[13px] text-[#9CA3AF] mt-1">{completedItems.length} deliverables produced</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sticky bottom bar */}
      {isReview && items.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-[#F0F0F0] px-8 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={handleSelectAll}
              className="text-[13px] font-medium text-[#4D5D4B] hover:underline"
            >
              {selectedItems.size === items.filter((i) => i.status === "planned").length
                ? "Deselect all"
                : "Select all"}
            </button>
            <span className="text-[14px] text-[#6B7280]">
              {selectedItems.size > 0 ? (
                <>
                  <span className="font-semibold text-[#1A1A1A]">{selectedItems.size}</span> of {items.filter((i) => i.status === "planned").length} selected
                  {" "}&middot;{" "}
                  <span className="font-mono">
                    ~{items.filter((i) => selectedItems.has(i.id)).reduce((s, i) => s + i.estimated_cost, 0)} credits
                  </span>
                </>
              ) : (
                <>Select items to approve</>
              )}
            </span>
          </div>
          <button
            onClick={handleApproveSelected}
            disabled={approving || selectedItems.size === 0}
            className="flex items-center gap-2 rounded-full bg-[#4D5D4B] text-white text-[14px] font-semibold px-6 py-3 hover:bg-[#3d4a3b] transition-colors disabled:opacity-30"
          >
            {approving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {approving
              ? "Starting..."
              : selectedItems.size > 0
              ? `Approve ${selectedItems.size} & Start`
              : "Select items first"}
          </button>
        </div>
      )}
    </div>
  );
}
