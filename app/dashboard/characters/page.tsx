"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Sparkles,
  ArrowRight,
  Volume2,
  Plus,
  Search,
  Crown,
  Mic,
} from "lucide-react";
import { spring, staggerContainer, staggerItem } from "@/lib/motion";

/* ────── Types ────── */
type Voice = {
  id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  previewUrl: string;
};

type Brand = {
  id: string;
  name: string;
  is_default?: boolean;
};

/* ────── Character data with placeholder images ────── */
const PLACEHOLDER_PHOTOS: Record<string, string> = {
  "Amira": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=500&fit=crop&crop=face",
  "Omar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&crop=face",
  "Yasmin": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&crop=face",
  "Khalid": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop&crop=face",
  "Sarah": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=500&fit=crop&crop=face",
  "James": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop&crop=face",
  "Fatima": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=500&fit=crop&crop=face",
  "Layla": "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=500&fit=crop&crop=face",
};

const characters = [
  { id: "1", name: "Amira", gender: "Female", age_range: "25-30", language: "ar", description: "Professional Arabic-speaking presenter. Confident, warm tone perfect for B2B and finance ads.", style: "Professional", is_premium: false, tags: ["Professional", "Arabic", "Female"] },
  { id: "2", name: "Omar", gender: "Male", age_range: "30-35", language: "ar", description: "Casual Arabic-speaking creator. Energetic delivery ideal for e-commerce and lifestyle brands.", style: "Casual", is_premium: false, tags: ["Casual", "Arabic", "Male"] },
  { id: "3", name: "Yasmin", gender: "Female", age_range: "20-25", language: "ar", description: "Young, trendy Arabic speaker. Perfect for social media, fashion, and Gen-Z targeting.", style: "Trendy", is_premium: false, tags: ["Trendy", "Arabic", "Female"] },
  { id: "4", name: "Khalid", gender: "Male", age_range: "35-40", language: "ar", description: "Authoritative Arabic speaker. Deep voice ideal for tech, automotive, and luxury brands.", style: "Authoritative", is_premium: true, tags: ["Authoritative", "Arabic", "Male"] },
  { id: "5", name: "Sarah", gender: "Female", age_range: "25-30", language: "en", description: "Natural English speaker. Friendly and relatable for SaaS, health, and education ads.", style: "Friendly", is_premium: false, tags: ["Friendly", "English", "Female"] },
  { id: "6", name: "James", gender: "Male", age_range: "28-35", language: "en", description: "Professional English presenter. Polished delivery for B2B, consulting, and enterprise.", style: "Professional", is_premium: false, tags: ["Professional", "English", "Male"] },
  { id: "7", name: "Fatima", gender: "Female", age_range: "30-35", language: "ar", description: "Empathetic Arabic speaker. Warm, storytelling style for NGOs, education, and community brands.", style: "Storyteller", is_premium: false, tags: ["Storyteller", "Arabic", "Female"] },
  { id: "8", name: "Layla", gender: "Female", age_range: "22-28", language: "fr", description: "French-Arabic bilingual. Perfect for North Africa — Morocco, Tunisia, Algeria campaigns.", style: "Bilingual", is_premium: true, tags: ["Bilingual", "French", "Female"] },
];

function getLanguageLabel(lang: string) {
  return lang === "ar" ? "Arabic" : lang === "fr" ? "French" : "English";
}

function getLanguageBadgeClass(lang: string) {
  if (lang === "ar") return "badge-green";
  if (lang === "en") return "badge-blue";
  if (lang === "fr") return "badge-purple";
  return "badge-dark";
}

/* ────── Voice Preview ────── */
function VoicePreviewPlayer({ previewUrl, voiceName }: { previewUrl: string; voiceName: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => {}); }
  }
  return (
    <>
      <audio ref={audioRef} src={previewUrl} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} preload="none" />
      <button
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] transition-colors"
        title={`Preview ${voiceName}`}
      >
        {playing ? <Pause className="h-3.5 w-3.5 text-[#1A1A1A]" /> : <Play className="h-3.5 w-3.5 text-[#1A1A1A] ms-0.5" />}
      </button>
    </>
  );
}

/* ────── Character Card ────── */
function CharacterCard({ char, onClick }: { char: typeof characters[0]; onClick: () => void }) {
  const photoUrl = PLACEHOLDER_PHOTOS[char.name];

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={spring.snappy}
      className="group text-left rounded-2xl overflow-hidden bg-white border border-[#F0F0F0] shadow-soft hover:shadow-medium transition-all"
    >
      {/* Photo — edge-to-edge, no padding */}
      <div className="relative aspect-[3/4] overflow-hidden">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={char.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#F3F4F6] to-[#E5E7EB] flex items-center justify-center">
            <span className="text-5xl font-bold text-[#1A1A1A]/10">{char.name.slice(0, 2).toUpperCase()}</span>
          </div>
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* Name + meta on image */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white text-[16px] font-semibold leading-tight">{char.name}</h3>
          <p className="text-white/70 text-[12px] mt-0.5">
            {char.gender} &middot; {char.age_range}
          </p>
        </div>

        {/* Language badge on image */}
        <div className="absolute top-3 left-3">
          <span className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium",
            getLanguageBadgeClass(char.language)
          )}>
            {getLanguageLabel(char.language)}
          </span>
        </div>

        {/* Premium badge */}
        {char.is_premium && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 bg-[#4D5D4B] text-white rounded-full">
            <Crown className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase">Pro</span>
          </div>
        )}
      </div>

      {/* Content below image */}
      <div className="p-4">
        <p className="text-[14px] text-[#6B7280] leading-relaxed line-clamp-2">{char.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {char.tags.map((tag) => (
            <span key={tag} className="px-2.5 py-1 bg-[#F3F4F6] rounded-full text-[11px] text-[#6B7280] font-medium">
              {tag}
            </span>
          ))}
        </div>

        {/* Voice style */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#F0F0F0]">
          <Mic className="h-3.5 w-3.5 text-[#4D5D4B]" />
          <span className="text-[12px] text-[#1A1A1A] font-medium">{char.style}</span>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-[#4D5D4B] font-medium">
            <span className="h-1.5 w-1.5 bg-[#4D5D4B] rounded-full animate-pulse-dot" />
            Ready
          </span>
        </div>
      </div>
    </motion.button>
  );
}

/* ────── Main Component ────── */
export default function CharactersPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [promptInput, setPromptInput] = useState("");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLang, setFilterLang] = useState<string | null>(null);
  const [selectedChar, setSelectedChar] = useState<typeof characters[0] | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/brands");
        if (res.ok) { const d = await res.json(); setBrands(d.brands || []); }
      } catch {} finally { setBrandsLoading(false); }

      try {
        const res = await fetch("/api/voices");
        if (res.ok) { const d = await res.json(); setVoices(d.voices || []); }
      } catch {} finally { setVoicesLoading(false); }
    }
    init();
  }, []);

  const defaultBrandId = brands.find((b) => b.is_default)?.id || brands[0]?.id || "";

  function handleUseCharacter(char: typeof characters[0]) {
    if (!defaultBrandId) { router.push("/dashboard/brands"); return; }
    const prompt = `Create a UGC video featuring ${char.name}, a ${char.style.toLowerCase()} ${char.gender.toLowerCase()} content creator speaking in ${getLanguageLabel(char.language)}. ${char.description}`;
    router.push(`/dashboard/generate?${new URLSearchParams({ type: "ugc_video", brandId: defaultBrandId, language: char.language, prompt })}`);
  }

  function handleCreateCharacter() {
    if (promptInput.trim()) {
      if (!defaultBrandId) { router.push("/dashboard/brands"); return; }
      const prompt = `Create a UGC character: ${promptInput}. Generate a character image first, then create a short video introduction.`;
      router.push(`/dashboard/generate?${new URLSearchParams({ type: "ugc_video", brandId: defaultBrandId, prompt })}`);
    }
  }

  // Filter characters
  const filteredChars = characters.filter((c) => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterLang && c.language !== filterLang) return false;
    return true;
  });

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 bg-white min-h-screen space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-[#1A1A1A] tracking-tight">Characters</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">{characters.length} AI presenters ready for your campaigns</p>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search characters..."
            className="w-full h-10 pl-10 pr-4 bg-white border border-[#F0F0F0] rounded-full text-[14px] text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none focus:border-[#4D5D4B] transition-colors"
          />
        </div>
        <div className="flex gap-1.5">
          {[null, "ar", "en", "fr"].map((lang) => (
            <button
              key={lang || "all"}
              onClick={() => setFilterLang(lang)}
              className={cn(
                "px-4 py-2 rounded-full text-[12px] font-medium transition-all",
                filterLang === lang
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-white border border-[#F0F0F0] text-[#6B7280] hover:border-[#E5E7EB] hover:text-[#1A1A1A]"
              )}
            >
              {lang === null ? "All" : lang === "ar" ? "Arabic" : lang === "en" ? "English" : "French"}
            </button>
          ))}
        </div>
      </div>

      {/* Character grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
      >
        {/* Create new character card */}
        <motion.div variants={staggerItem}>
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#4D5D4B] to-[#3a4839] text-white p-6 flex flex-col justify-between min-h-[360px]">
            <div>
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-white/10 mb-4">
                <Sparkles className="h-6 w-6 text-white/80" />
              </div>
              <h3 className="text-[16px] font-semibold leading-snug mb-2">Create your own</h3>
              <p className="text-[14px] text-white/60 leading-relaxed">
                Describe the character you need — voice, tone, language, personality — and we&apos;ll bring them to life.
              </p>
            </div>

            <div className="mt-6">
              <div className="relative">
                <input
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="A warm Arabic narrator for luxury brands..."
                  className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 px-4 py-3 pr-12 text-[14px] rounded-xl focus:outline-none focus:border-white/50 transition-colors"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateCharacter(); }}
                />
                <button
                  onClick={handleCreateCharacter}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Character cards */}
        {filteredChars.map((char) => (
          <motion.div key={char.id} variants={staggerItem}>
            <CharacterCard char={char} onClick={() => setSelectedChar(selectedChar?.id === char.id ? null : char)} />
          </motion.div>
        ))}

        {/* Selected character detail */}
        {selectedChar && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-full rounded-2xl border border-[#E5E7EB] bg-white p-6"
          >
            <div className="flex items-start gap-5">
              <div className="h-24 w-24 rounded-xl bg-gradient-to-br from-[#F3F4F6] to-[#E5E7EB] flex items-center justify-center shrink-0">
                <span className="text-[28px] font-bold text-[#9CA3AF]">{selectedChar.name[0]}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-[18px] font-bold text-[#1A1A1A]">{selectedChar.name}</h3>
                <p className="text-[13px] text-[#6B7280] mt-1">{selectedChar.description}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[11px] font-medium text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded">{selectedChar.style}</span>
                  <span className="text-[11px] font-medium text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded">{getLanguageLabel(selectedChar.language)}</span>
                  <span className="text-[11px] font-medium text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded">{selectedChar.gender}</span>
                </div>
              </div>
              <button
                onClick={() => handleUseCharacter(selectedChar)}
                className="shrink-0 flex items-center gap-2 rounded-full bg-[#1A1A1A] text-white px-5 py-2.5 text-[13px] font-semibold hover:bg-[#333] transition-colors"
              >
                Use in ad <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Voice Library */}
      {!voicesLoading && voices.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Volume2 className="h-4 w-4 text-[#9CA3AF]" />
            <p className="text-[12px] font-medium text-[#9CA3AF] uppercase tracking-wider">Voice Library</p>
            <span className="text-[11px] text-[#9CA3AF] ml-1">{voices.length} voices</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {voices.slice(0, 12).map((voice) => (
              <div
                key={voice.id}
                className="flex items-center gap-3 bg-white border border-[#F0F0F0] rounded-2xl p-3.5 hover:shadow-medium transition-all hover:-translate-y-0.5"
              >
                <VoicePreviewPlayer previewUrl={voice.previewUrl} voiceName={voice.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[#1A1A1A] truncate">{voice.name}</p>
                  <div className="flex gap-1.5 mt-1.5">
                    {voice.category && (
                      <span className="badge-green px-2 py-0.5 rounded-full text-[11px] font-medium">{voice.category}</span>
                    )}
                    {Object.values(voice.labels).slice(0, 2).map((val, i) => (
                      <span key={i} className="badge-blue px-2 py-0.5 rounded-full text-[11px] font-medium">{val}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* No brands warning */}
      {!brandsLoading && brands.length === 0 && (
        <div className="bg-[#FEF2F2] border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <span className="h-2 w-2 bg-[#EF4444] rounded-full shrink-0" />
          <p className="text-[14px] text-[#1A1A1A]">
            No brand found. <Link href="/dashboard/brands" className="underline font-medium text-[#4D5D4B]">Add a brand</Link> before generating videos.
          </p>
        </div>
      )}
    </div>
  );
}
