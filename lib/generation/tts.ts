/**
 * Unified TTS Module — ElevenLabs (eleven_v3).
 */

import { textToSpeech } from "@/lib/generation/elevenlabs";

// ============================================
// Types
// ============================================

export type SpeechOptions = {
  text: string;
  language: string;
  /** Direct ElevenLabs voice ID — bypasses style-based selection */
  voice_id?: string;
  /** Style keywords for automatic voice selection */
  style?: string;
};

export type SpeechResult = {
  audioBuffer: ArrayBuffer;
  format: "mp3" | "wav";
  durationEstimate: number;
};

export type VoiceInfo = {
  id: string;
  name: string;
  category: string;
  language?: string;
  previewUrl?: string;
  labels: Record<string, string>;
};

// ============================================
// Curated Voice Catalog
// ============================================

/** Curated ElevenLabs voices — each chosen for a specific creative role. */
export const VOICE_CATALOG = {
  // Male voices
  hale:        { id: "wWWn96OtTHu1sn8SRGEr", name: "Hale",        gender: "male",   style: "expressive, deep, emotive",       bestFor: "storytelling, emotional ads, brand films" },
  b_giffen:    { id: "Gpn64ViAPE8OHwnBHpEs", name: "B.Giffen",    gender: "male",   style: "professional, narration",         bestFor: "explainers, eLearning, corporate" },
  clemens:     { id: "eJHgBguIWw9PtA4GHbSP", name: "Clemens",     gender: "male",   style: "loud, energetic, attention-grabbing", bestFor: "hooks, hype, energetic ads" },
  christopher: { id: "SSfU0eLfP3qeuR4j2bwD", name: "Christopher", gender: "male",   style: "smooth, deep, engaging",          bestFor: "premium narration, brand films, luxury" },
  // Female voices
  koraly:      { id: "rbFGGoDXFHtVghjHuS3E", name: "Koraly",      gender: "female", style: "promotional, polished",           bestFor: "promo videos, marketing, launches" },
  camille:     { id: "Da9VfudgKUvFOKayCiue", name: "Camille",     gender: "female", style: "content creator, casual",         bestFor: "UGC, social media, conversational" },
  kat:         { id: "RiK8PTtVIeKKoFFTk9fg", name: "Kat",         gender: "female", style: "sharp, smart, educator",          bestFor: "tutorials, educational, instructional" },
  sophie:      { id: "BewlJwjEWiFLWoXrbGMf", name: "Sophie",      gender: "female", style: "engaging, warm",                  bestFor: "advertising, social media, friendly" },
  // Additional
  extra_male:  { id: "brPzcy4pXMIUtw6RPYu0", name: "Extra",       gender: "male",   style: "versatile",                       bestFor: "general purpose" },
} as const;

export type VoiceName = keyof typeof VOICE_CATALOG;

/**
 * Pick the best voice based on style/context keywords.
 * The agent can also pass a direct voice_id to bypass this logic.
 */
function pickElevenLabsVoiceId(language?: string, style?: string): string {
  const s = (style || "").toLowerCase();

  // Match by style keywords
  if (s.includes("energetic") || s.includes("hype") || s.includes("loud")) return VOICE_CATALOG.clemens.id;
  if (s.includes("storytelling") || s.includes("emotive") || s.includes("emotional")) return VOICE_CATALOG.hale.id;
  if (s.includes("premium") || s.includes("luxury") || s.includes("smooth") || s.includes("deep")) return VOICE_CATALOG.christopher.id;
  if (s.includes("professional") || s.includes("corporate") || s.includes("narration")) return VOICE_CATALOG.b_giffen.id;
  if (s.includes("ugc") || s.includes("casual") || s.includes("creator") || s.includes("content")) return VOICE_CATALOG.camille.id;
  if (s.includes("promo") || s.includes("launch") || s.includes("polished")) return VOICE_CATALOG.koraly.id;
  if (s.includes("educator") || s.includes("tutorial") || s.includes("sharp")) return VOICE_CATALOG.kat.id;
  if (s.includes("warm") || s.includes("friendly") || s.includes("social")) return VOICE_CATALOG.sophie.id;

  // Gender-based fallbacks
  if (s.includes("female")) return VOICE_CATALOG.sophie.id;
  if (s.includes("male")) return VOICE_CATALOG.christopher.id;

  // Default: Sophie for a warm, engaging ad voice
  return VOICE_CATALOG.sophie.id;
}

// ============================================
// ElevenLabs TTS
// ============================================

/**
 * Resolve a voice_id that might be a name (e.g. "Christopher") to the actual ElevenLabs ID.
 */
function resolveVoiceId(voiceIdOrName: string): string {
  const asKey = voiceIdOrName.toLowerCase() as VoiceName;
  if (asKey in VOICE_CATALOG) {
    return VOICE_CATALOG[asKey].id;
  }

  for (const entry of Object.values(VOICE_CATALOG)) {
    if (entry.name.toLowerCase() === voiceIdOrName.toLowerCase()) {
      return entry.id;
    }
  }

  return voiceIdOrName;
}

async function generateSpeechElevenLabs(
  text: string,
  language?: string,
  style?: string,
  voiceIdOverride?: string
): Promise<ArrayBuffer> {
  // If a direct voice_id is passed, resolve it (handles names like "Ghizlane" → actual ID).
  // Otherwise pick based on style.
  const voiceId = voiceIdOverride ? resolveVoiceId(voiceIdOverride) : pickElevenLabsVoiceId(language, style);

  const audioBuffer = await textToSpeech(text, voiceId, {
    model: "eleven_v3",
  });

  return audioBuffer;
}

// ============================================
// Unified TTS Router
// ============================================

/**
 * Generate speech via ElevenLabs.
 */
export async function generateSpeech(
  options: SpeechOptions
): Promise<SpeechResult> {
  const { text, language, voice_id, style } = options;

  const wordCount = text.split(/\s+/).length;

  console.log("[tts] ElevenLabs", language || "en", voice_id ? `(voice_id: ${voice_id})` : `(style: ${style})`);
  const audioBuffer = await generateSpeechElevenLabs(
    text,
    language,
    style,
    voice_id
  );
  const durationEstimate = Math.round(wordCount / 2.5);
  return { audioBuffer, format: "mp3", durationEstimate };
}

// ============================================
// List available voices
// ============================================

/**
 * List available voices from ElevenLabs.
 */
export async function listAvailableVoices(
  language?: string
): Promise<VoiceInfo[]> {
  const response = await fetch(
    "https://api.elevenlabs.io/v1/voices",
    {
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs voices error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as {
    voices: Array<{
      voice_id: string;
      name: string;
      category: string;
      labels: Record<string, string>;
      preview_url?: string;
    }>;
  };

  const voices: VoiceInfo[] = data.voices.map((v) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
    language: v.labels?.language,
    previewUrl: v.preview_url,
    labels: v.labels || {},
  }));

  if (language) {
    return voices.filter(
      (v) =>
        v.language?.toLowerCase().includes(language.toLowerCase()) ||
        v.labels?.language?.toLowerCase().includes(language.toLowerCase())
    );
  }

  return voices;
}
