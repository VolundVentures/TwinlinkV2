"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Trash2,
  CalendarDays,
  ImageIcon,
  Film,
  Layers,
  Plus,
  X,
  Loader2,
  List,
  Grid3X3,
  CalendarRange,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

/* ────── Types ────── */
type ScheduledPost = {
  id: string;
  platform: string;
  scheduled_at: string;
  published_at: string | null;
  status: string;
  caption: string | null;
  hashtags: string[] | null;
  post_type: string;
  carousel_slides: unknown;
  generation_assets?: {
    id: string;
    public_url: string | null;
    thumbnail_url: string | null;
    type: string;
    aspect_ratio: string | null;
    metadata: Record<string, unknown>;
  } | null;
};

type MarketEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string | null;
  market: string | null;
};

type AssetOption = {
  id: string;
  public_url: string | null;
  thumbnail_url: string | null;
  type: string;
  generation_title: string | null;
};

type ViewMode = "month" | "week" | "list";

/* ────── Constants ────── */
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  tiktok: "#00F2EA",
  linkedin: "#0A66C2",
  x: "#1A1A1A",
};

const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ────── Helpers ────── */
function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getDayOfWeekMondayStart(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function isWeekend(dayIndex: number): boolean {
  return dayIndex % 7 === 5 || dayIndex % 7 === 6;
}

function PostTypeIcon({ postType }: { postType: string }) {
  switch (postType) {
    case "video": return <Film className="h-3 w-3" />;
    case "carousel": return <Layers className="h-3 w-3" />;
    default: return <ImageIcon className="h-3 w-3" />;
  }
}

/* ────── Status badge ────── */
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "bg-[#4D5D4B]/10 text-[#4D5D4B] border-[#4D5D4B]/20",
    scheduled: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-red-50 text-[#E4405F] border-red-200",
  };
  return (
    <span className={cn(
      "inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] font-medium capitalize",
      styles[status] || "bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB]"
    )}>
      {status}
    </span>
  );
}

/* ────── Post card for list/week views ────── */
function PostCard({ post, onClick }: { post: ScheduledPost; onClick: () => void }) {
  const color = PLATFORM_COLORS[post.platform] || "#6B7280";
  const thumbnailUrl = post.generation_assets?.thumbnail_url || post.generation_assets?.public_url;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -1, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}
      transition={spring.snappy}
      className="flex items-center gap-3 w-full rounded-xl border border-[#F0F0F0] border-l-[3px] p-3 text-left transition-all bg-white"
      style={{ borderLeftColor: color }}
    >
      {/* Thumbnail */}
      {thumbnailUrl && (
        <img src={thumbnailUrl} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-[13px] font-semibold text-[#1A1A1A]">
            {PLATFORM_NAMES[post.platform] || post.platform}
          </span>
          <PostTypeIcon postType={post.post_type} />
        </div>
        {post.caption && (
          <p className="text-[12px] text-[#6B7280] line-clamp-1">{post.caption}</p>
        )}
      </div>

      {/* Time */}
      <div className="text-right shrink-0">
        <p className="font-mono text-[12px] text-[#1A1A1A]">{formatTime(post.scheduled_at)}</p>
        <p className="text-[11px] text-[#9CA3AF]">{formatDateFull(post.scheduled_at)}</p>
      </div>
    </motion.button>
  );
}

/* ────── Main Component ────── */
export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  // Schedule dialog state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDay, setScheduleDay] = useState<number | null>(null);
  const [schedulePlatform, setSchedulePlatform] = useState("instagram");
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [scheduleCaption, setScheduleCaption] = useState("");
  const [scheduleHashtags, setScheduleHashtags] = useState("");
  const [scheduleAssetId, setScheduleAssetId] = useState<string | null>(null);
  const [recentAssets, setRecentAssets] = useState<AssetOption[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [saving, setSaving] = useState(false);

  const monthKey = getMonthKey(currentDate);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [postsRes, eventsRes] = await Promise.all([
        fetch(`/api/calendar/posts?month=${monthKey}`),
        fetch(`/api/calendar/events?month=${monthKey}`),
      ]);
      if (postsRes.ok) { const d = await postsRes.json(); setPosts(d.posts ?? []); }
      if (eventsRes.ok) { const d = await eventsRes.json(); setEvents(d.events ?? []); }
    } catch (err) {
      console.error("Failed to fetch calendar:", err);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function fetchRecentAssets() {
    setLoadingAssets(true);
    try {
      const res = await fetch("/api/generations?limit=10");
      if (res.ok) {
        const data = await res.json();
        const assets: AssetOption[] = [];
        for (const gen of data.generations || []) {
          for (const asset of gen.generation_assets || []) {
            if (asset.public_url) {
              assets.push({ id: asset.id, public_url: asset.public_url, thumbnail_url: asset.thumbnail_url, type: asset.type, generation_title: gen.title });
            }
          }
        }
        setRecentAssets(assets.slice(0, 20));
      }
    } catch {} finally { setLoadingAssets(false); }
  }

  function goToPrevMonth() { setCurrentDate((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1)); }
  function goToNextMonth() { setCurrentDate((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1)); }
  function goToToday() { setCurrentDate(new Date()); }

  const [scheduleDate, setScheduleDate] = useState("");

  function openScheduleDialog(dayNum?: number) {
    if (dayNum) {
      setScheduleDay(dayNum);
      setScheduleDate(`${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`);
    } else {
      setScheduleDay(null);
      const t = new Date();
      setScheduleDate(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`);
    }
    setSchedulePlatform("instagram");
    setScheduleTime("10:00");
    setScheduleCaption("");
    setScheduleHashtags("");
    setScheduleAssetId(null);
    setScheduleOpen(true);
    fetchRecentAssets();
  }

  async function handleCreatePost() {
    if (!scheduleDate) return;
    setSaving(true);
    try {
      const [y, m, d] = scheduleDate.split("-").map(Number);
      const scheduledAt = new Date(y, m - 1, d);
      const [hours, minutes] = scheduleTime.split(":").map(Number);
      scheduledAt.setHours(hours, minutes, 0, 0);
      const hashtags = scheduleHashtags.split(/[,\s#]+/).map((t) => t.trim()).filter(Boolean);
      const selectedAsset = recentAssets.find((a) => a.id === scheduleAssetId);
      const res = await fetch("/api/calendar/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: scheduleAssetId || null, platform: schedulePlatform, scheduledAt: scheduledAt.toISOString(), caption: scheduleCaption || null, hashtags, postType: selectedAsset?.type || "image" }),
      });
      if (res.ok) { setScheduleOpen(false); fetchData(); }
    } catch (err) { console.error("Failed to create post:", err); } finally { setSaving(false); }
  }

  async function handleDeletePost(postId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/calendar/posts/${postId}`, { method: "DELETE" });
      if (res.ok) { setPosts((prev) => prev.filter((p) => p.id !== postId)); setDetailOpen(false); setSelectedPost(null); }
    } catch {} finally { setDeleting(false); }
  }

  // Build calendar grid data
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = new Date(year, month, 1);
  const startOffset = getDayOfWeekMondayStart(firstDayOfMonth);
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const today = new Date();

  const postsByDay = new Map<number, ScheduledPost[]>();
  for (const post of posts) {
    const d = new Date(post.scheduled_at);
    if (d.getMonth() === month && d.getFullYear() === year) {
      const day = d.getDate();
      (postsByDay.get(day) || (() => { const a: ScheduledPost[] = []; postsByDay.set(day, a); return a; })()).push(post);
    }
  }

  const eventsByDay = new Map<number, MarketEvent[]>();
  for (const event of events) {
    const d = new Date(event.event_date + "T00:00:00");
    if (d.getMonth() === month && d.getFullYear() === year) {
      const day = d.getDate();
      (eventsByDay.get(day) || (() => { const a: MarketEvent[] = []; eventsByDay.set(day, a); return a; })()).push(event);
    }
  }

  // Upcoming posts (next 5)
  const upcomingPosts = posts
    .filter((p) => new Date(p.scheduled_at) >= today && p.status !== "published")
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 5);

  return (
    <div className="flex h-full gap-6 px-8 py-6">
      {/* Main calendar area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-5">
            <h1 className="text-[32px] font-bold text-[#1A1A1A] leading-tight">{getMonthLabel(currentDate)}</h1>
            <div className="flex items-center gap-1">
              <button onClick={goToPrevMonth} className="flex items-center justify-center h-9 w-9 rounded-full border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors">
                <ChevronLeft className="h-4 w-4 text-[#6B7280]" />
              </button>
              <button onClick={goToNextMonth} className="flex items-center justify-center h-9 w-9 rounded-full border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors">
                <ChevronRight className="h-4 w-4 text-[#6B7280]" />
              </button>
            </div>
            <button onClick={goToToday} className="px-4 py-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1A1A1A] rounded-full border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors">
              Today
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex bg-[#F4F4F5] rounded-full p-1 gap-0.5">
              {([
                { mode: "month" as const, label: "Month" },
                { mode: "week" as const, label: "Week" },
                { mode: "list" as const, label: "List" },
              ]).map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "flex items-center justify-center h-8 px-4 rounded-full text-[13px] font-medium transition-all",
                    viewMode === mode ? "bg-[#1A1A1A] text-white shadow-sm" : "text-[#6B7280] hover:text-[#1A1A1A]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => openScheduleDialog()}
              className="flex items-center gap-1.5 bg-[#4D5D4B] text-white px-5 py-2.5 rounded-full text-[14px] font-semibold hover:bg-[#3d4d3b] transition-colors"
            >
              <Plus className="h-4 w-4" /> Schedule
            </button>
          </div>
        </div>

        {/* View content */}
        <AnimatePresence mode="wait">
          {viewMode === "month" && (
            <motion.div
              key="month"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-2">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="px-2 py-2 text-center text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                    {day}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 border-t border-l border-[#F0F0F0] rounded-2xl overflow-hidden">
                {Array.from({ length: totalCells }).map((_, i) => {
                  const dayNum = i - startOffset + 1;
                  const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                  const cellDate = isCurrentMonth ? new Date(year, month, dayNum) : null;
                  const isToday = cellDate ? isSameDay(cellDate, today) : false;
                  const isWeekendCell = isWeekend(i);
                  const dayPosts = isCurrentMonth ? postsByDay.get(dayNum) || [] : [];
                  const dayEvents = isCurrentMonth ? eventsByDay.get(dayNum) || [] : [];

                  return (
                    <div
                      key={i}
                      onClick={() => isCurrentMonth && openScheduleDialog(dayNum)}
                      className={cn(
                        "min-h-[120px] border-r border-b border-[#F0F0F0] p-2.5 group relative transition-colors cursor-pointer",
                        !isCurrentMonth
                          ? "bg-[#FAFAFA] cursor-default"
                          : isToday
                            ? "bg-[#4D5D4B]/5"
                            : isWeekendCell
                              ? "bg-[#FAFAFA] hover:bg-[#F4F4F5]"
                              : "bg-white hover:bg-[#F9FAFB]"
                      )}
                    >
                      {isCurrentMonth ? (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className={cn(
                              "flex items-center justify-center text-[14px] font-semibold",
                              isToday
                                ? "bg-[#4D5D4B] text-white rounded-full h-7 w-7"
                                : "text-[#1A1A1A]"
                            )}>
                              {dayNum}
                            </span>
                            <span className="flex h-6 w-6 items-center justify-center rounded-full text-[#9CA3AF] opacity-0 group-hover:opacity-100 hover:bg-[#F0F0F0] transition-all">
                              <Plus className="h-3 w-3" />
                            </span>
                          </div>

                          {/* Event dots */}
                          {dayEvents.map((event) => (
                            <div key={event.id} className="mb-1 px-2 py-0.5 text-[10px] text-[#9CA3AF] bg-[#F9FAFB] rounded-md truncate">
                              {event.title}
                            </div>
                          ))}

                          {/* Post indicators */}
                          {dayPosts.length > 0 && (
                            <div className="space-y-1">
                              {dayPosts.slice(0, 2).map((post) => (
                                <button
                                  key={post.id}
                                  onClick={(e) => { e.stopPropagation(); setSelectedPost(post); setDetailOpen(true); }}
                                  className="flex items-center gap-1.5 w-full rounded-lg px-2 py-1 text-left border-l-[3px] bg-white/80 hover:bg-white transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                                  style={{ borderLeftColor: PLATFORM_COLORS[post.platform] || "#6B7280" }}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: PLATFORM_COLORS[post.platform] || "#6B7280" }} />
                                  <span className="text-[11px] font-medium text-[#6B7280] truncate">{formatTime(post.scheduled_at)}</span>
                                </button>
                              ))}
                              {dayPosts.length > 2 && (
                                <span className="text-[10px] font-medium text-[#9CA3AF] px-2">+{dayPosts.length - 2} more</span>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-[14px] font-semibold text-[#D1D5DB]">{dayNum > 0 ? dayNum : getDaysInMonth(year, month - 1) + dayNum}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {viewMode === "list" && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 space-y-2"
            >
              {posts.length === 0 ? (
                <div className="text-center py-20">
                  <CalendarDays className="h-10 w-10 text-[#E5E7EB] mx-auto mb-3" />
                  <p className="text-[14px] text-[#9CA3AF]">No posts scheduled this month</p>
                </div>
              ) : (
                [...posts]
                  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                  .map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onClick={() => { setSelectedPost(post); setDetailOpen(true); }}
                    />
                  ))
              )}
            </motion.div>
          )}

          {viewMode === "week" && (
            <motion.div
              key="week"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              {/* Current week view */}
              <div className="grid grid-cols-7 gap-3">
                {Array.from({ length: 7 }).map((_, i) => {
                  const dayOffset = getDayOfWeekMondayStart(today);
                  const weekDay = new Date(today);
                  weekDay.setDate(today.getDate() - dayOffset + i);
                  const dayNum = weekDay.getDate();
                  const isCurrentDay = isSameDay(weekDay, today);
                  const dayPosts = weekDay.getMonth() === month ? postsByDay.get(dayNum) || [] : [];

                  return (
                    <div key={i} className={cn(
                      "min-h-[300px] rounded-2xl border p-3",
                      isCurrentDay ? "border-[#4D5D4B] bg-[#4D5D4B]/5" : "border-[#F0F0F0] bg-white"
                    )}>
                      <div className="text-center mb-3">
                        <p className="text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF]">{WEEKDAYS[i]}</p>
                        <p className={cn(
                          "text-[18px] font-semibold mt-0.5",
                          isCurrentDay ? "text-[#1A1A1A]" : "text-[#6B7280]"
                        )}>
                          {dayNum}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {dayPosts.map((post) => (
                          <button
                            key={post.id}
                            onClick={() => { setSelectedPost(post); setDetailOpen(true); }}
                            className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 border-l-[3px] bg-white/80 hover:bg-white transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                            style={{ borderLeftColor: PLATFORM_COLORS[post.platform] || "#6B7280" }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: PLATFORM_COLORS[post.platform] || "#6B7280" }} />
                            <span className="text-[11px] font-medium text-[#6B7280] truncate">{formatTime(post.scheduled_at)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!loading && posts.length === 0 && viewMode === "month" && (
          <div className="mt-6 flex flex-col items-center justify-center text-center">
            <CalendarDays className="h-10 w-10 text-[#E5E7EB]" />
            <p className="mt-3 text-[14px] font-semibold text-[#1A1A1A]">No posts scheduled</p>
            <p className="mt-1 text-[13px] text-[#9CA3AF]">Click on any day or use &quot;Schedule&quot; to get started.</p>
          </div>
        )}
      </div>

      {/* Right sidebar — upcoming deliverables */}
      <div className="w-72 shrink-0 hidden xl:block">
        <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-4">Upcoming</p>
          {upcomingPosts.length === 0 ? (
            <p className="text-[14px] text-[#9CA3AF] text-center py-6">No upcoming posts</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingPosts.map((post) => {
                const color = PLATFORM_COLORS[post.platform] || "#6B7280";
                const thumb = post.generation_assets?.thumbnail_url || post.generation_assets?.public_url;
                const scheduledDate = new Date(post.scheduled_at);
                const daysUntil = Math.ceil((scheduledDate.getTime() - today.getTime()) / 86400000);

                return (
                  <button
                    key={post.id}
                    onClick={() => { setSelectedPost(post); setDetailOpen(true); }}
                    className="w-full text-left rounded-xl border border-[#F0F0F0] border-l-[3px] p-3 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all"
                    style={{ borderLeftColor: color }}
                  >
                    <div className="flex items-start gap-3">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-[#F9FAFB] flex items-center justify-center shrink-0">
                          <PostTypeIcon postType={post.post_type} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[#1A1A1A] truncate">
                          {post.caption || `${PLATFORM_NAMES[post.platform]} Post`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-[11px] font-medium text-[#6B7280]">
                            {PLATFORM_NAMES[post.platform]}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#6B7280] mt-0.5">
                          {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`} &middot; {formatTime(post.scheduled_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Post detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md !rounded-2xl !border-[#F0F0F0] shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-[20px] font-bold text-[#1A1A1A]">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[selectedPost.platform] || "#6B7280" }} />
                  {PLATFORM_NAMES[selectedPost.platform] || selectedPost.platform} Post
                </DialogTitle>
                <DialogDescription>
                  <span className="flex items-center gap-1.5 text-[#6B7280]">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(selectedPost.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} at {formatTime(selectedPost.scheduled_at)}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {(selectedPost.generation_assets?.public_url || selectedPost.generation_assets?.thumbnail_url) && (
                  <div className="overflow-hidden rounded-xl bg-[#F9FAFB]">
                    {selectedPost.generation_assets.type === "video" ? (
                      <video src={selectedPost.generation_assets.public_url || ""} controls playsInline className="w-full" />
                    ) : (
                      <img src={selectedPost.generation_assets.public_url || selectedPost.generation_assets.thumbnail_url || ""} alt="" className="w-full object-contain" />
                    )}
                  </div>
                )}
                {selectedPost.caption && (
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Caption</p>
                    <p className="text-[13px] text-[#6B7280] whitespace-pre-wrap">{selectedPost.caption}</p>
                  </div>
                )}
                {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedPost.hashtags.map((tag) => (
                      <span key={tag} className="inline-flex items-center h-6 px-2.5 rounded-full bg-[#F9FAFB] border border-[#F0F0F0] text-[11px] font-medium text-[#6B7280]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedPost.status} />
                  <span className="inline-flex items-center h-6 px-2.5 rounded-full border border-[#E5E7EB] text-[11px] font-medium text-[#6B7280] capitalize">
                    {selectedPost.post_type}
                  </span>
                </div>
              </div>
              <DialogFooter>
                <button
                  onClick={() => handleDeletePost(selectedPost.id)}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-50 text-[#E4405F] text-[13px] font-medium border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {deleting ? "Deleting..." : "Delete"}
                </button>
                <DialogClose>
                  <span className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#E5E7EB] text-[13px] font-medium text-[#6B7280] hover:bg-[#F9FAFB] transition-colors cursor-pointer">
                    Close
                  </span>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule post dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-lg !rounded-2xl !border-[#F0F0F0] shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
          <DialogHeader>
            <DialogTitle className="text-[20px] font-bold text-[#1A1A1A]">Schedule Post</DialogTitle>
            <DialogDescription>
              <span className="text-[#6B7280]">
                Choose a date, time, and platform for your post.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Platform */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2.5 block">Platform</label>
              <div className="flex gap-2">
                {Object.entries(PLATFORM_NAMES).map(([key, name]) => (
                  <button key={key} onClick={() => setSchedulePlatform(key)}
                    className={cn("flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium transition-all",
                      schedulePlatform === key ? "bg-[#1A1A1A] text-white shadow-sm" : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#D1D5DB]"
                    )}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[key] }} /> {name}
                  </button>
                ))}
              </div>
            </div>
            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2.5 block">Date</label>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full h-12 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#1A1A1A] outline-none focus:border-[#4D5D4B] transition-colors" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2.5 block">Time</label>
                <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full h-12 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#1A1A1A] outline-none focus:border-[#4D5D4B] transition-colors" />
              </div>
            </div>
            {/* Caption */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2.5 block">Caption</label>
              <textarea value={scheduleCaption} onChange={(e) => setScheduleCaption(e.target.value)} placeholder="Write your caption..." rows={3}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none focus:border-[#4D5D4B] transition-colors resize-none" />
            </div>
            {/* Hashtags */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2.5 block">Hashtags</label>
              <input value={scheduleHashtags} onChange={(e) => setScheduleHashtags(e.target.value)} placeholder="trending, marketing, brand"
                className="w-full h-12 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none focus:border-[#4D5D4B] transition-colors" />
            </div>
            {/* Asset selection */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2.5 block">Select Asset</label>
              {loadingAssets ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#9CA3AF]" /></div>
              ) : recentAssets.length === 0 ? (
                <p className="text-[14px] text-[#9CA3AF] py-4 text-center">No assets yet.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                  {recentAssets.map((asset) => (
                    <button key={asset.id} onClick={() => setScheduleAssetId(scheduleAssetId === asset.id ? null : asset.id)}
                      className={cn("relative rounded-xl overflow-hidden aspect-square bg-[#F9FAFB] transition-all",
                        scheduleAssetId === asset.id ? "ring-2 ring-[#4D5D4B] ring-offset-2" : "hover:opacity-80"
                      )}>
                      {asset.type === "video" ? (
                        <div className="relative w-full h-full">
                          <video src={asset.public_url || ""} className="w-full h-full object-cover" muted playsInline />
                          <Film className="absolute bottom-1 right-1 h-3 w-3 text-white drop-shadow" />
                        </div>
                      ) : (
                        <img src={asset.thumbnail_url || asset.public_url || ""} alt="" className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-2">
            <button onClick={() => setScheduleOpen(false)} className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-[#E5E7EB] text-[13px] font-medium text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
              Cancel
            </button>
            <button onClick={handleCreatePost} disabled={saving} className="flex items-center gap-1.5 bg-[#4D5D4B] text-white px-5 py-2.5 rounded-full text-[14px] font-semibold hover:bg-[#3d4d3b] transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
              {saving ? "Scheduling..." : "Schedule"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
