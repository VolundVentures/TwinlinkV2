"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "@/lib/i18n/use-translations";
import {
  Send,
  Square,
  AlertCircle,
  Loader2,
  Download,
  CheckCircle2,
  XCircle,
  Sparkles,
  Globe,
  Search,
  Lightbulb,
  Image,
  Video,
  FileText,
  Mic,
  TrendingUp,
  ChevronDown,
  Play,
  Users,
  LayoutGrid,
  ClipboardList,
  PanelRightOpen,
  PanelRightClose,
  Music,
  Wand2,
  Film,
  Pause,
  Paperclip,
  ArrowRight,
  CalendarDays,
  Plus,
  Zap,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---- Types ---- */

type Message = { role: "user" | "agent" | "system"; content: string };
type Asset = { id: string; type: "image" | "video" | "audio" | "script"; url: string; metadata?: Record<string, string> };
type ToolExecution = { id: string; name: string; displayName: string; status: "running" | "success" | "failed"; summary?: string; startedAt: number };

/* ---- Tool mappings ---- */

const TOOL_NAMES: Record<string, string> = {
  analyze_brand: "Analyzing Brand", research_competitor: "Researching Competitor",
  generate_creative_brief: "Creating Strategy", generate_image: "Generating Image Assets",
  generate_video: "Creating Video Sequence", generate_avatar_video: "Creating Avatar",
  animate_ad: "Animating Ad", write_script: "Writing Script",
  generate_voiceover: "Creating Voiceover", search_trends: "Searching Trends",
  generate_carousel: "Creating Carousel", propose_content_plan: "Planning Content",
  compose_video: "Exporting Master File", generate_character: "Generating Character",
  generate_music: "Creating Music", generate_motion_graphic: "Rendering Motion Graphic",
  create_storyboard: "Building Storyboard", schedule_post: "Scheduling Post",
  replicate_ad: "Replicating Competitor Ad",
};

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  analyze_brand: Globe, research_competitor: Search, generate_creative_brief: Lightbulb,
  generate_image: Image, generate_video: Film, generate_avatar_video: Users,
  animate_ad: Play, write_script: FileText, generate_voiceover: Mic,
  search_trends: TrendingUp, generate_carousel: LayoutGrid, propose_content_plan: ClipboardList,
  compose_video: Film, generate_character: Users, generate_music: Music,
  generate_motion_graphic: Wand2, create_storyboard: ClipboardList,
  schedule_post: CalendarDays, replicate_ad: Search,
};

function toolDisplayName(name: string): string { return TOOL_NAMES[name] ?? name.replace(/_/g, " "); }

/* ---- Elapsed time ---- */

function ElapsedTime({ startedAt, stopped }: { startedAt: number; stopped: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (stopped) return; const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, [stopped]);
  const s = Math.round((now - startedAt) / 1000);
  const fmt = s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  return <span className="mono text-[12px] text-[#9CA3AF]">{fmt}</span>;
}

/* ---- Audio Player ---- */

function AudioPlayer({ url, label }: { url: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onTime = () => { setProgress(a.currentTime); setDuration(a.duration || 0); };
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime); a.addEventListener("loadedmetadata", onTime); a.addEventListener("ended", onEnd);
    return () => { a.removeEventListener("timeupdate", onTime); a.removeEventListener("loadedmetadata", onTime); a.removeEventListener("ended", onEnd); };
  }, []);

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-3">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button onClick={() => { const a = audioRef.current; if (!a) return; playing ? a.pause() : a.play(); setPlaying(!playing); }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1A1A1A] text-white">
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ms-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#1A1A1A] truncate">{label}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-[3px] rounded-full bg-[#F3F4F6] overflow-hidden">
            <div className="h-full rounded-full bg-[#1A1A1A] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="mono text-[10px] text-[#9CA3AF]">{fmt(progress)}/{fmt(duration)}</span>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
/*  PAGE                                                             */
/* ================================================================ */

type BrandOption = { id: string; name: string; logo_url?: string | null; is_default?: boolean };

export default function GeneratePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type") || "";
  const brandIdParam = searchParams.get("brandId") || "";
  const language = searchParams.get("language") || "auto";
  const userPrompt = searchParams.get("prompt") || "";
  const existingGenerationId = searchParams.get("generationId") || "";

  // Load brands — agent detects which brand to use from user's prompt
  const [brands, setBrands] = useState<BrandOption[]>([]);

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.ok ? r.json() : { brands: [] })
      .then((d) => {
        const list = d.brands || [];
        setBrands(list);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // If URL has a specific brandId, use it. If only 1 brand, auto-select. Otherwise let agent decide.
  const brandId = brandIdParam || (brands.length === 1 ? brands[0].id : "");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [expandedScripts, setExpandedScripts] = useState<Set<string>>(new Set());
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightTab, setRightTab] = useState<"activity" | "preview">("activity");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pastSessions, setPastSessions] = useState<Array<{ id: string; generationId: string; title: string; type: string; messageCount: number; createdAt: string }>>([]);

  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  // Ref to always have latest messages (avoids stale closure in useCallback)
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  // Ref for generationId to persist across follow-ups
  const generationIdRef = useRef<string | null>(null);
  useEffect(() => { generationIdRef.current = generationId; }, [generationId]);

  useEffect(() => {
    // Scroll to bottom immediately + after images load (multiple passes)
    const el = scrollRef.current;
    if (!el) return;
    const scroll = () => { el.scrollTop = el.scrollHeight; };
    scroll();
    // After DOM paint
    const t1 = setTimeout(scroll, 100);
    // After images likely loaded
    const t2 = setTimeout(scroll, 500);
    const t3 = setTimeout(scroll, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [messages, assets, thinkingText]);
  useEffect(() => { if (selectedAsset) setRightTab("preview"); }, [selectedAsset]);

  /* ---- SSE Agent ---- */
  const startAgent = useCallback(async (extraPrompt?: string, existingGenerationId?: string) => {
    setIsRunning(true); setThinkingText(""); setRightTab("activity");
    abortRef.current = new AbortController();
    const prompt = extraPrompt || userPrompt || "Generate content for this brand";
    const promptWithContext = type ? `[type: ${type}] ${prompt}` : prompt;

    // Build conversation history from ref (always current, avoids stale closure)
    const currentMessages = messagesRef.current;
    const conversationHistory = currentMessages
      .filter((m) => m.role === "user" || m.role === "agent")
      .map((m) => ({ role: (m.role === "agent" ? "assistant" : "user") as "user" | "assistant", content: m.content }));

    // Only reuse generationId for REAL follow-ups (when there are previous messages)
    // If messages are empty, this is a new chat — don't attach to an old generation
    const isRealFollowUp = conversationHistory.length > 0;
    const activeGenerationId = existingGenerationId || (isRealFollowUp ? generationIdRef.current : null);

    const requestBody: Record<string, unknown> = { language, prompt: promptWithContext };
    if (brandId) requestBody.brandId = brandId;
    if (activeGenerationId) requestBody.generationId = activeGenerationId;
    if (isRealFollowUp && conversationHistory.length > 0) requestBody.conversationHistory = conversationHistory;

    try {
      const response = await fetch("/api/agent/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody), signal: abortRef.current.signal });
      if (!response.ok) throw new Error((await response.text()) || "Agent execution failed");
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n"); buffer = blocks.pop() || "";

        for (const block of blocks) {
          const eventMatch = block.match(/event: (.+)/);
          const dataMatch = block.match(/data: (.+)/);
          if (!eventMatch || !dataMatch) continue;
          const eventType = eventMatch[1].trim();
          if (eventType === "heartbeat") continue;
          let data: Record<string, unknown>;
          try { data = JSON.parse(dataMatch[1]); } catch { continue; }

          switch (eventType) {
            case "session_start": setSessionId(String(data.sessionId || "")); setGenerationId(String(data.generationId || "")); break;
            case "thinking": setThinkingText((p) => p + String(data.text || "")); break;
            case "agent_message": setThinkingText(""); setMessages((p) => [...p, { role: "agent", content: String(data.content || "") }]); break;
            case "tool_start": { const n = String(data.toolName || ""); setToolExecutions((p) => [...p, { id: String(data.toolCallId || ""), name: n, displayName: toolDisplayName(n), status: "running", startedAt: Date.now() }]); break; }
            case "tool_progress": setToolExecutions((p) => p.map((t) => t.id === String(data.toolCallId || "") ? { ...t, summary: String(data.message || "") } : t)); break;
            case "tool_result": setToolExecutions((p) => p.map((t) => t.id === String(data.toolCallId || "") ? { ...t, status: (data.success ? "success" : "failed") as "success" | "failed", summary: String(data.summary || "") } : t)); break;
            case "asset_ready": { const a: Asset = { id: String(data.assetId || ""), type: String(data.type || "image") as Asset["type"], url: String(data.url || ""), metadata: data.metadata as Record<string, string> | undefined }; setAssets((p) => [...p, a]); setSelectedAsset((c) => c || a); break; }
            case "credits_deducted": setCreditsRemaining(data.remaining as number); break;
            case "error": setMessages((p) => [...p, { role: "system", content: String(data.message || "Unknown error") }]); break;
            case "complete": setGenerationId(String(data.generationId || "")); setCompleted(true); break;
            case "storyboard_ready": {
              setMessages((p) => [...p, { role: "agent", content: `**Storyboard ready!** [View & edit storyboard](/dashboard/generate/storyboard?generationId=${String(data.generationId || "")})` }]);
              break;
            }
            case "credits_update": {
              setCreditsRemaining(data.remaining as number);
              break;
            }
          }
        }
      }
    } catch (error) { if (error instanceof Error && error.name !== "AbortError") setMessages((p) => [...p, { role: "system", content: error.message }]); }
    finally { setIsRunning(false); setThinkingText(""); }
  }, [brandId, language, userPrompt, type]);

  // Save messages to session whenever they change and we have a sessionId
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;
    const saveable = messages.filter((m) => m.role !== "system");
    if (saveable.length === 0) return;
    const timer = setTimeout(() => {
      fetch(`/api/agent/sessions/${sessionId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: saveable }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [messages, sessionId]);

  // Load past sessions on mount
  useEffect(() => {
    fetch("/api/agent/sessions")
      .then((r) => r.ok ? r.json() : { sessions: [] })
      .then((d) => setPastSessions(d.sessions || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (startedRef.current) return; startedRef.current = true;

    if (existingGenerationId) {
      setGenerationId(existingGenerationId);
      setCompleted(true);
      fetch(`/api/generations/${existingGenerationId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.generation) {
            const gen = data.generation;
            if (gen.prompt) setMessages([{ role: "user", content: gen.prompt }]);
            const loadedAssets: Asset[] = (gen.generation_assets || [])
              .filter((a: { public_url: string | null }) => a.public_url)
              .map((a: { id: string; type: string; public_url: string; metadata?: Record<string, string> }) => ({
                id: a.id,
                type: a.type as Asset["type"],
                url: a.public_url,
                metadata: a.metadata,
              }));
            setAssets(loadedAssets);
            if (loadedAssets.length > 0) setSelectedAsset(loadedAssets[0]);
          }
        })
        .catch(() => {});
      return;
    }

    // If no brand selected, the agent can still work — it will ask for details or use general context
    if (!brandId) {
      // Don't block — let user start typing. The agent works without a brand.
      return;
    }
    if (userPrompt) {
      setMessages([{ role: "user", content: userPrompt }]);
      const url = new URL(window.location.href);
      url.searchParams.delete("prompt");
      window.history.replaceState({}, "", url.toString());
      startAgent();
    }
  }, [brandId, userPrompt, startAgent, existingGenerationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!input.trim() && attachedFiles.length === 0) return;
    const msg = input.trim(); setInput("");

    // Upload attached files first, get their URLs
    let fileContext = "";
    if (attachedFiles.length > 0) {
      const uploadedUrls: string[] = [];
      for (const file of attachedFiles) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("name", file.name);
          formData.append("source", "chat");
          const res = await fetch("/api/assets", { method: "POST", body: formData });
          if (res.ok) {
            const { asset } = await res.json();
            if (asset?.url) uploadedUrls.push(asset.url);
          }
        } catch {}
      }
      if (uploadedUrls.length > 0) {
        fileContext = `\n\n[Attached ${uploadedUrls.length} file(s): ${uploadedUrls.join(", ")}]`;
      }
      setAttachedFiles([]);
    }

    const fullMsg = msg + fileContext;
    const newMessages = [...messages, { role: "user" as const, content: fullMsg }];
    setMessages(newMessages);
    messagesRef.current = newMessages;
    if (!isRunning) {
      setCompleted(false); setToolExecutions([]);
      startAgent(fullMsg);
    }
  }

  const completedCount = toolExecutions.filter((t) => t.status !== "running").length;
  const progressPct = toolExecutions.length > 0 ? (completedCount / toolExecutions.length) * 100 : 0;

  async function loadSession(sess: typeof pastSessions[0]) {
    // Load the session's messages and assets directly (no page navigation)
    setMessages([]);
    setAssets([]);
    setSelectedAsset(null);
    setToolExecutions([]);
    setCompleted(true);
    setGenerationId(sess.generationId);
    setSessionId(sess.id);

    try {
      // Load generation assets
      const genRes = await fetch(`/api/generations/${sess.generationId}`);
      if (genRes.ok) {
        const data = await genRes.json();
        if (data?.generation) {
          const gen = data.generation;
          const loadedAssets: Asset[] = (gen.generation_assets || [])
            .filter((a: { public_url: string | null }) => a.public_url)
            .map((a: { id: string; type: string; public_url: string; metadata?: Record<string, string> }) => ({
              id: a.id, type: a.type as Asset["type"], url: a.public_url, metadata: a.metadata,
            }));
          setAssets(loadedAssets);
          if (loadedAssets.length > 0) setSelectedAsset(loadedAssets[0]);
        }
      }

      // Load conversation messages from session
      const sessRes = await fetch(`/api/agent/sessions/${sess.id}/messages`);
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        if (sessData?.messages && sessData.messages.length > 0) {
          setMessages(sessData.messages.map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "agent" as const : m.role as "user" | "agent" | "system",
            content: m.content,
          })));
        }
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  }

  function startNewChat() {
    setMessages([]); setAssets([]); setSelectedAsset(null); setGenerationId(null);
    setCompleted(false); setToolExecutions([]); setSessionId(null);
    startedRef.current = false;
    // Clear refs immediately (don't wait for useEffect)
    generationIdRef.current = null;
    messagesRef.current = [];
    router.push("/dashboard/generate");
  }

  /* ================================================================ */
  return (
    <div className="flex h-full overflow-hidden">

      {/* HISTORY SIDEBAR — always visible on desktop */}
      <div className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-[#F0F0F0] bg-[#FAFAFA]">
        {/* New chat button */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F3F4F6] transition-colors"
          >
            <Plus className="h-4 w-4 text-[#9CA3AF]" />
            New chat
          </button>
        </div>

        {/* Recents label */}
        <div className="px-4 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Recents</span>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2">
          {pastSessions.length === 0 ? (
            <p className="text-[12px] text-[#9CA3AF] text-center py-8 px-4">Your conversations will appear here</p>
          ) : (
            <div className="space-y-0.5">
              {pastSessions.map((sess) => (
                <button
                  key={sess.id}
                  onClick={() => loadSession(sess)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg transition-colors text-[13px]",
                    sess.generationId === generationId
                      ? "bg-white text-[#1A1A1A] shadow-sm"
                      : "text-[#6B7280] hover:bg-white hover:text-[#1A1A1A]"
                  )}
                >
                  <p className="font-medium truncate">{sess.title}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                    {new Date(sess.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Brand list — informational only, agent detects from prompt */}
        {brands.length > 1 && (
          <div className="border-t border-[#F0F0F0] p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] px-1">Your Brands</span>
            <div className="mt-1.5 space-y-0.5">
              {brands.map((b) => (
                <div key={b.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-[#6B7280]">
                  {b.logo_url ? (
                    <img src={b.logo_url} alt="" className="h-4 w-4 rounded object-contain shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded bg-[#E5E7EB] flex items-center justify-center text-[8px] font-bold text-[#6B7280]">
                      {b.name.charAt(0)}
                    </div>
                  )}
                  <span className="truncate">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MAIN -- Chat */}
      <div className="flex flex-1 flex-col bg-white">

        {/* No brand bar — agent detects brand from user prompt */}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          <div className="mx-auto max-w-2xl space-y-6 px-4 sm:px-6 py-6 sm:py-8">
            {/* Welcome */}
            {messages.length === 0 && !isRunning && (
              <div className="animate-fade-in">
                {/* Greeting */}
                <div className="text-center mb-8 pt-8">
                  <h2 className="text-[22px] font-bold text-[#1A1A1A] tracking-tight">What will you create?</h2>
                  <p className="text-[14px] text-[#9CA3AF] mt-1">Pick a template or describe anything you want.</p>
                </div>

                {/* Template cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                  {[
                    {
                      id: "ugc",
                      title: "UGC Testimonial",
                      desc: "Person reviews product with B-roll. 30s video.",
                      icon: Users,
                      gradient: "from-[#4D5D4B] to-[#2d3a2b]",
                      prompt: "Create a UGC testimonial video ad. A person naturally reviews and endorses the product, intercut with product close-ups and lifestyle B-roll. 8 shots, 30 seconds, 9:16 for TikTok/Reels.",
                    },
                    {
                      id: "hero",
                      title: "Product Hero",
                      desc: "Cinematic product showcase. 24s video.",
                      icon: Film,
                      gradient: "from-[#1A1A1A] to-[#333]",
                      prompt: "Create a cinematic product hero video. Dramatic close-ups, orbital camera moves, and seamless transitions between shots. No person — pure product visual storytelling with voiceover. 6 shots, 24 seconds, 9:16.",
                    },
                    {
                      id: "static",
                      title: "Static Ad",
                      desc: "Single high-impact ad image with copy.",
                      icon: Image,
                      gradient: "from-[#FF7675] to-[#d63031]",
                      prompt: "Create a static ad image for social media. High-impact visual with headline, body text, and a CTA. 1080x1080 (1:1) format. Use the brand's visual identity.",
                    },
                    {
                      id: "carousel",
                      title: "Carousel",
                      desc: "Multi-slide story for Instagram/LinkedIn.",
                      icon: LayoutGrid,
                      gradient: "from-[#6C5CE7] to-[#4834d4]",
                      prompt: "Create a carousel ad with 4-6 slides that tell a compelling story. Each slide builds on the previous one. Instagram format (1080x1080). Include strong CTA on the last slide.",
                    },
                    {
                      id: "research",
                      title: "Competitor Research",
                      desc: "Analyze a competitor's ad strategy.",
                      icon: Search,
                      gradient: "from-[#636e72] to-[#2d3436]",
                      prompt: "Research my competitors' ad strategies. Analyze their visual style, messaging, platforms, and ad frequency. Give me actionable insights on how to differentiate.",
                    },
                    {
                      id: "quick",
                      title: "Quick Social",
                      desc: "Fast 15s multi-shot video ad.",
                      icon: Zap,
                      gradient: "from-[#FBBF24] to-[#F59E0B]",
                      prompt: "Create a quick social media video ad. Fast-paced, 3-5 shots, 15 seconds max. Energetic and attention-grabbing. 9:16 for TikTok/Reels.",
                    },
                  ].map((tmpl) => {
                    const Icon = tmpl.icon;
                    return (
                      <button
                        key={tmpl.id}
                        onClick={() => {
                          setInput(tmpl.prompt);
                        }}
                        className={cn("rounded-2xl p-5 text-left bg-gradient-to-br transition-all hover:shadow-lg hover:-translate-y-0.5", tmpl.gradient)}
                      >
                        <Icon className="h-6 w-6 text-white/70 mb-3" />
                        <h3 className="text-[15px] font-bold text-white mb-1">{tmpl.title}</h3>
                        <p className="text-[12px] text-white/60 leading-relaxed">{tmpl.desc}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Or type anything */}
                <p className="text-center text-[12px] text-[#9CA3AF]">
                  Or just type anything below — describe your brand, product, or creative vision.
                </p>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3 animate-fade-in-up", msg.role === "user" && "justify-end")}>
                {msg.role === "agent" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded mt-0.5 bg-[#4D5D4B]">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                {msg.role === "system" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded mt-0.5 bg-[#FEF2F2]">
                    <AlertCircle className="h-3.5 w-3.5 text-[#EF4444]" />
                  </div>
                )}
                <div className={cn("max-w-[85%]",
                  msg.role === "user" && "rounded-2xl bg-[#F3F4F6] text-[#1A1A1A] px-4 py-3 text-[15px] leading-[1.65]",
                  msg.role === "agent" && "agent-prose",
                  msg.role === "system" && "text-[13px] text-[#EF4444]"
                )}>
                  {msg.role === "agent" ? (
                    <div>
                      <p className="label-caps mb-2">TwinLink AI</p>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
              </div>
            ))}

            {/* Thinking */}
            {thinkingText && (
              <div className="flex gap-3 animate-fade-in-up">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#4D5D4B] mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="agent-prose">
                  <p className="label-caps mb-2">TwinLink AI</p>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{thinkingText}</ReactMarkdown>
                  <span className="inline-block w-[2px] h-4 bg-[#1A1A1A] animate-pulse ms-0.5 align-middle" />
                </div>
              </div>
            )}

            {/* Agent thinking indicator */}
            {isRunning && !thinkingText && messages.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded bg-[#4D5D4B]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                </div>
                <p className="text-[14px] text-[#6B7280] italic">Thinking...</p>
              </div>
            )}

            {/* Assets inline */}
            {assets.length > 0 && (
              <div className="space-y-4">
                <p className="text-[14px] text-[#1A1A1A]">I&apos;ve generated some visual assets for your review:</p>
                <div className="grid grid-cols-2 gap-4">
                  {assets.filter(a => a.type === "image").map((asset, i) => (
                    <div key={asset.id} className="relative group cursor-pointer rounded-xl overflow-hidden bg-[#F3F4F6] animate-scale-in transition-shadow hover:shadow-medium" style={{ width: 200 }} onClick={() => setSelectedAsset(asset)}>
                      <img src={asset.url} alt="" className="w-full aspect-[4/5] object-cover" />
                      <div className="absolute bottom-3 start-3">
                        <span className="mono text-[11px] bg-white/90 backdrop-blur-sm rounded px-2 py-1 text-[#1A1A1A] font-medium">
                          K_VISUAL_{String(i + 1).padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {assets.filter(a => a.type === "video").map((asset) => (
                  <div key={asset.id} className="relative group cursor-pointer rounded-xl overflow-hidden bg-[#1A1A1A] animate-scale-in transition-shadow hover:shadow-medium" onClick={() => setSelectedAsset(asset)}>
                    <video src={asset.url} className="w-full aspect-video object-cover opacity-80" muted playsInline />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                        <Play className="h-6 w-6 text-white ms-0.5" />
                      </div>
                    </div>
                  </div>
                ))}
                {assets.filter(a => a.type === "audio").map((asset) => {
                  const audioLabel = asset.metadata?.asset_category === "background_music"
                    ? (asset.metadata?.title || "Background Music")
                    : "Voiceover";
                  return (
                    <div key={asset.id} className="bg-white border border-[#F0F0F0] rounded-xl p-4 animate-scale-in transition-shadow hover:shadow-soft" onClick={() => setSelectedAsset(asset)}>
                      <AudioPlayer url={asset.url} label={audioLabel} />
                    </div>
                  );
                })}
                {assets.filter(a => a.type === "script").map((asset) => (
                  <div key={asset.id} className="bg-white border border-[#F0F0F0] rounded-xl p-5 animate-scale-in cursor-pointer transition-shadow hover:shadow-soft" onClick={() => { const s = new Set(expandedScripts); s.has(asset.id) ? s.delete(asset.id) : s.add(asset.id); setExpandedScripts(s); setSelectedAsset(asset); }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#9CA3AF]" />
                        <span className="text-[13px] font-semibold text-[#1A1A1A]">{asset.metadata?.title || "Script"}</span>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 text-[#9CA3AF] transition-transform", !expandedScripts.has(asset.id) && "-rotate-90")} />
                    </div>
                    {expandedScripts.has(asset.id) && <pre className="mt-3 text-[13px] text-[#6B7280] leading-relaxed whitespace-pre-wrap font-sans">{asset.metadata?.text || asset.url}</pre>}
                  </div>
                ))}
              </div>
            )}

            {completed && generationId && (
              <div className="space-y-4 pt-4">
                {/* Follow-up suggestions */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Create 3 more variants", prompt: "Generate 3 more variant versions of what you just created" },
                    { label: "Generate TikTok version (9:16)", prompt: "Create a 9:16 TikTok version of this ad" },
                    { label: "Write matching ad copy", prompt: "Write Meta ad copy (headline, body, CTA) to go with the creatives you generated" },
                    { label: "Schedule to calendar", prompt: "Schedule the best creative to Instagram for the next optimal posting time" },
                  ].map((suggestion) => (
                    <button
                      key={suggestion.label}
                      onClick={() => { setInput(suggestion.prompt); }}
                      className="text-start bg-[#FAFAFA] border border-[#F0F0F0] rounded-xl px-4 py-3 text-[12px] text-[#6B7280] hover:text-[#1A1A1A] hover:border-[#E5E7EB] transition-colors mono uppercase tracking-[0.04em]"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center">
                  <button onClick={() => router.push(`/dashboard/generations/${generationId}`)} className="text-[13px] text-[#6B7280] hover:text-[#1A1A1A] underline underline-offset-2 transition-colors">
                    View full generation <ArrowRight className="inline h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 bg-white border-t border-[#F0F0F0]">
          <form onSubmit={handleSubmit} className="mx-auto">
            <div className="flex items-end gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
              <textarea
                value={input}
                onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; }}
                placeholder="How can I help you today?"
                className="flex-1 bg-transparent text-[16px] text-[#1A1A1A] placeholder:text-[#C4C4C4] outline-none resize-none min-h-[44px] max-h-[200px] leading-[1.6] py-1"
                rows={2}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
              />
              {isRunning ? (
                <button type="button" onClick={() => { abortRef.current?.abort(); setIsRunning(false); }} className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#EF4444] hover:bg-[#FEF2F2] transition-colors shrink-0">
                  <Square className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button type="submit" disabled={!input.trim()} className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#4D5D4B] text-white disabled:opacity-20 hover:bg-[#3d4a3b] transition-colors shrink-0">
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Attached files preview */}
            {attachedFiles.length > 0 && (
              <div className="flex gap-2 mt-2 px-1 flex-wrap">
                {attachedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-[#F3F4F6] rounded-lg px-2 py-1 text-[11px] text-[#6B7280]">
                    {f.type.startsWith("image/") ? (
                      <img src={URL.createObjectURL(f)} alt="" className="h-6 w-6 rounded object-cover" />
                    ) : (
                      <Paperclip className="h-3 w-3" />
                    )}
                    <span className="truncate max-w-[100px]">{f.name}</span>
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="text-[#9CA3AF] hover:text-[#EF4444]">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 mt-2 px-1">
              <input
                ref={chatFileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                  e.target.value = "";
                }}
              />
              <button type="button" onClick={() => chatFileInputRef.current?.click()} className="flex items-center gap-1.5 text-[12px] text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors">
                <Paperclip className="h-3.5 w-3.5" /> Attach
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT -- Activity / Preview */}
      <div className={cn(
        "flex-col border-l border-[#F0F0F0] bg-white",
        "lg:flex lg:w-[340px]",
        rightPanelOpen ? "flex w-full absolute inset-0 z-40 lg:relative lg:inset-auto" : "hidden"
      )}>
        {/* Mobile close */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[#F0F0F0]">
          <span className="text-[13px] font-semibold text-[#1A1A1A]">Activity</span>
          <button onClick={() => setRightPanelOpen(false)} className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] transition-colors">
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>

        {/* Current task header */}
        {(isRunning || completed) && (
          <div className="px-5 py-4 text-end border-b border-[#F0F0F0]">
            <p className="label-caps">Current Task</p>
            <p className="text-[13px] font-bold uppercase tracking-wide text-[#1A1A1A] mt-0.5 truncate">
              {messages.find(m => m.role === "user")?.content.slice(0, 40) || "Generation"}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[#F0F0F0]">
          {(["activity", "preview"] as const).map((tab) => (
            <button key={tab} onClick={() => setRightTab(tab)}
              className={cn("flex-1 py-3 text-[13px] font-medium uppercase tracking-wider transition-colors",
                rightTab === tab ? "text-[#1A1A1A] border-b-2 border-[#1A1A1A]" : "text-[#9CA3AF] hover:text-[#6B7280]"
              )}>{tab}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ACTIVITY */}
          {rightTab === "activity" && (
            <div className="px-5 py-5">
              {toolExecutions.length === 0 && !isRunning && (
                <p className="text-[13px] text-[#9CA3AF] text-center py-8">No activity yet</p>
              )}

              {toolExecutions.length > 0 && (
                <div>
                  <p className="label-caps mb-4">Process Timeline</p>
                  {/* Overall progress bar */}
                  {isRunning && (
                    <div className="mb-4">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
                        <div className="h-full rounded-full bg-[#4D5D4B] transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="space-y-0">
                    {toolExecutions.map((tool, i) => (
                      <div key={tool.id} className="flex gap-3 animate-fade-in-up">
                        {/* Node */}
                        <div className="flex flex-col items-center">
                          <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                            tool.status === "success" && "bg-[#4D5D4B]",
                            tool.status === "running" && "bg-[#4D5D4B]",
                            tool.status === "failed" && "bg-[#EF4444]"
                          )}>
                            {tool.status === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                            {tool.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-white" />}
                            {tool.status === "failed" && <XCircle className="h-3.5 w-3.5 text-white" />}
                          </div>
                          {i < toolExecutions.length - 1 && <div className="w-[2px] flex-1 min-h-[20px] bg-[#F0F0F0] my-1" />}
                        </div>
                        {/* Content */}
                        <div className="flex-1 pb-4">
                          <div className="flex items-center justify-between">
                            <p className={cn("text-[13px] font-semibold", tool.status === "failed" ? "text-[#EF4444]" : "text-[#1A1A1A]")}>{tool.displayName}</p>
                            <ElapsedTime startedAt={tool.startedAt} stopped={tool.status !== "running"} />
                          </div>
                          {tool.summary && <p className="text-[12px] text-[#9CA3AF] mt-0.5 line-clamp-2">{tool.summary}</p>}
                          {/* Tool execution card with colored left border */}
                          {tool.status === "running" && (
                            <div className="mt-2 rounded-xl bg-[#FAFAFA] border-l-[3px] border-amber-400 px-3 py-2">
                              <div className="h-[3px] rounded-full bg-[#F3F4F6] overflow-hidden">
                                <div className="h-full bg-[#4D5D4B] rounded-full animate-pulse" style={{ width: "60%" }} />
                              </div>
                            </div>
                          )}
                          {tool.status === "success" && tool.summary && (
                            <div className="mt-2 rounded-xl bg-[#FAFAFA] border-l-[3px] border-green-500 px-3 py-2">
                              <p className="text-[12px] text-[#6B7280]">{tool.summary}</p>
                            </div>
                          )}
                          {tool.status === "failed" && tool.summary && (
                            <div className="mt-2 rounded-xl bg-[#FAFAFA] border-l-[3px] border-red-500 px-3 py-2">
                              <p className="text-[12px] text-[#EF4444]">{tool.summary}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata tags */}
              {completed && (
                <div className="mt-6 bg-[#FAFAFA] rounded-xl p-4">
                  <p className="label-caps mb-3">Metadata Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {["#creative", "#ai_generated", `#${assets.length}_assets`].map((tag) => (
                      <span key={tag} className="mono text-[11px] bg-white border border-[#F0F0F0] rounded px-2.5 py-1 text-[#6B7280]">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PREVIEW */}
          {rightTab === "preview" && (
            <div className="p-5">
              {selectedAsset ? (
                <div className="space-y-4">
                  {selectedAsset.type === "image" && <div className="rounded-xl overflow-hidden shadow-soft"><img src={selectedAsset.url} alt="" className="w-full" /></div>}
                  {selectedAsset.type === "video" && <div className="rounded-xl overflow-hidden bg-[#1A1A1A] shadow-soft"><video src={selectedAsset.url} controls playsInline className="w-full" /></div>}
                  {selectedAsset.type === "audio" && <AudioPlayer url={selectedAsset.url} label={
                    selectedAsset.metadata?.asset_category === "background_music"
                      ? (selectedAsset.metadata?.title || "Background Music")
                      : "Voiceover"
                  } />}
                  {selectedAsset.type === "script" && <pre className="text-[13px] text-[#6B7280] leading-relaxed whitespace-pre-wrap font-sans">{selectedAsset.metadata?.text || selectedAsset.url}</pre>}
                  {selectedAsset.metadata?.headline && (
                    <div>
                      <h3 className="text-[15px] font-semibold text-[#1A1A1A]">{selectedAsset.metadata.headline}</h3>
                      {selectedAsset.metadata.body && <p className="text-[13px] text-[#6B7280] mt-1">{selectedAsset.metadata.body}</p>}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    {selectedAsset.type !== "script" && (
                      <button onClick={() => window.open(selectedAsset.url, "_blank")} className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-black transition-colors">
                        <Download className="h-4 w-4" /> Download High-Res
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[#9CA3AF] text-center py-8">Select an asset to preview</p>
              )}
            </div>
          )}
        </div>

        {/* Bottom actions */}
        {completed && (
          <div className="px-5 py-4 flex gap-3 border-t border-[#F0F0F0]">
            <button className="flex-1 rounded-xl border border-[#E5E7EB] py-2.5 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#F3F4F6] transition-colors uppercase tracking-wider">
              Save Draft
            </button>
            <button onClick={() => generationId && router.push(`/dashboard/generations/${generationId}`)}
              className="flex-1 rounded-xl bg-[#4D5D4B] py-2.5 text-[13px] font-semibold text-white hover:bg-[#3d4a3b] transition-colors uppercase tracking-wider">
              Export
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
