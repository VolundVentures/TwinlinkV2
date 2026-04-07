/**
 * Unified TTS Module
 *
 * Routes to the best TTS provider based on language:
 * - Arabic: Gemini 2.5 Pro TTS (superior Arabic quality)
 * - English / other: ElevenLabs (eleven_v3 — most natural, highest quality)
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
  /** Gemini voice name (for Arabic) */
  voice?: string;
  /** Style keywords for automatic voice selection: 'ugc', 'premium', 'energetic', etc. */
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
  ghizlane:    { id: "OfGMGmhShO8iL9jCkXy8", name: "Ghizlane",    gender: "female", style: "Moroccan Darija dialect",         bestFor: "Moroccan content, Darija voiceovers" },
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

  // Moroccan Darija — use Ghizlane
  if (s.includes("darija") || s.includes("moroccan")) {
    return VOICE_CATALOG.ghizlane.id;
  }

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
// PCM to WAV conversion
// ============================================

/**
 * Convert raw PCM audio (s16le, mono, 24000Hz) to WAV format.
 */
function pcmToWav(
  pcmData: Uint8Array,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): ArrayBuffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.byteLength;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Copy PCM data
  const uint8View = new Uint8Array(buffer);
  uint8View.set(pcmData, headerSize);

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ============================================
// Gemini TTS (for Arabic)
// ============================================

type GeminiTTSResponse = {
  candidates: Array<{
    content: {
      parts: Array<{
        inlineData?: {
          mimeType: string;
          data: string; // base64 PCM
        };
      }>;
    };
  }>;
};

async function generateSpeechGemini(
  text: string,
  voice?: string
): Promise<ArrayBuffer> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-tts:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice || "Kore",
          },
        },
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Gemini TTS error: ${response.status} - ${error}`
    );
  }

  const data = (await response.json()) as GeminiTTSResponse;
  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;

  if (!inlineData?.data) {
    throw new Error("Gemini TTS returned no audio data");
  }

  // Decode base64 PCM data
  const binaryString = atob(inlineData.data);
  const pcmBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pcmBytes[i] = binaryString.charCodeAt(i);
  }

  // Convert PCM (24000Hz, s16le, mono) to WAV
  const wavBuffer = pcmToWav(pcmBytes, 24000, 1, 16);
  return wavBuffer;
}

// ============================================
// ElevenLabs TTS (for English and other languages)
// ============================================

/**
 * Resolve a voice_id that might be a name (e.g. "Ghizlane") to the actual ElevenLabs ID.
 * Case-insensitive lookup against VOICE_CATALOG names and keys.
 */
function resolveVoiceId(voiceIdOrName: string): string {
  // Check if it matches a catalog key (e.g. "ghizlane", "christopher")
  const asKey = voiceIdOrName.toLowerCase() as VoiceName;
  if (asKey in VOICE_CATALOG) {
    return VOICE_CATALOG[asKey].id;
  }

  // Check if it matches a catalog entry's name (e.g. "B.Giffen", "Ghizlane")
  for (const entry of Object.values(VOICE_CATALOG)) {
    if (entry.name.toLowerCase() === voiceIdOrName.toLowerCase()) {
      return entry.id;
    }
  }

  // Not a known name — assume it's already a real ElevenLabs voice ID
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
 * Generate speech using the best TTS provider for the given language.
 * Arabic -> Gemini 2.5 Pro TTS
 * English / other -> ElevenLabs
 */
export async function generateSpeech(
  options: SpeechOptions
): Promise<SpeechResult> {
  const { text, language, voice, voice_id, style } = options;
  const isArabic = language === "ar" || language === "arabic";
  // Moroccan Darija uses Gemini TTS (unless a specific ElevenLabs voice like Ghizlane is requested)
  const isMoroccan = language === "ar-MA" || (style || "").toLowerCase().includes("darija");
  const useGemini = (isArabic || isMoroccan) && !voice_id;

  const wordCount = text.split(/\s+/).length;

  if (useGemini) {
    console.log("[tts] Using Gemini 2.5 Pro TTS for Arabic/Moroccan");
    const audioBuffer = await generateSpeechGemini(text, voice);
    const durationEstimate = Math.round(wordCount / 2);
    return { audioBuffer, format: "wav", durationEstimate };
  }

  console.log("[tts] Using ElevenLabs for", language || "en", voice_id ? `(voice_id: ${voice_id})` : `(style: ${style})`);
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
